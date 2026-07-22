use serde::Serialize;

use crate::error::Result;
use crate::repository::open;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffFile {
    pub path: String,
    pub status: String,
    pub additions: i32,
    pub deletions: i32,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub header: String,
    pub old_start: i32,
    pub old_lines: i32,
    pub new_start: i32,
    pub new_lines: i32,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub origin: String,
    pub content: String,
    pub old_lineno: Option<i32>,
    pub new_lineno: Option<i32>,
}

pub fn get_working_tree_diff(path: &str) -> Result<Vec<DiffFile>> {
    let repo = open(path)?;
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let mut opts = git2::DiffOptions::new();
    opts.ignore_submodules(true);
    let diff = repo.diff_tree_to_workdir(head_tree.as_ref(), Some(&mut opts))?;
    diff_to_files(&diff)
}

pub fn get_staged_diff(path: &str) -> Result<Vec<DiffFile>> {
    let repo = open(path)?;
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let mut index = repo.index()?;
    let index_tree_oid = index.write_tree_to(&repo)?;
    let index_tree_obj = repo.find_tree(index_tree_oid)?;
    let diff = repo.diff_tree_to_tree(head_tree.as_ref(), Some(&index_tree_obj), None)?;
    diff_to_files(&diff)
}

pub fn get_commit_diff(path: &str, oid: &str) -> Result<Vec<DiffFile>> {
    let repo = open(path)?;
    let oid = git2::Oid::from_str(oid).map_err(|e| crate::error::GitError::Other(e.to_string()))?;
    let commit = repo.find_commit(oid)?;
    let commit_tree = commit.tree()?;

    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());

    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), None)?;
    diff_to_files(&diff)
}

fn diff_to_files(diff: &git2::Diff) -> Result<Vec<DiffFile>> {
    let mut files = Vec::new();

    for delta in diff.deltas() {
        let path = delta
            .new_file()
            .path()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();
        let status = match delta.status() {
            git2::Delta::Added => "A",
            git2::Delta::Deleted => "D",
            git2::Delta::Modified => "M",
            git2::Delta::Renamed => "R",
            git2::Delta::Copied => "C",
            git2::Delta::Untracked => "?",
            _ => " ",
        }
        .to_string();

        files.push(DiffFile {
            path,
            status,
            additions: 0,
            deletions: 0,
            hunks: Vec::new(),
        });
    }

    Ok(files)
}

pub fn get_file_diff_text(path: &str, file_path: &str) -> Result<String> {
    let repo = open(path)?;
    let relative = crate::status::normalize_relative_path(path, file_path);
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(&relative);
    let diff = repo.diff_tree_to_workdir(head_tree.as_ref(), Some(&mut opts))?;
    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(content);
        }
        true
    })?;
    Ok(diff_text)
}

pub fn get_commit_file_diff_text(path: &str, oid: &str, file_path: &str) -> Result<String> {
    let repo = open(path)?;
    let relative = crate::status::normalize_relative_path(path, file_path);
    let oid = git2::Oid::from_str(oid).map_err(|e| crate::error::GitError::Other(e.to_string()))?;
    let commit = repo.find_commit(oid)?;
    let commit_tree = commit.tree()?;
    let parent_tree = commit.parent(0).ok().and_then(|p| p.tree().ok());
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(&relative);
    let diff = repo.diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut opts))?;
    let mut diff_text = String::new();
    diff.print(git2::DiffFormat::Patch, |_delta, _hunk, line| {
        if let Ok(content) = std::str::from_utf8(line.content()) {
            diff_text.push_str(content);
        }
        true
    })?;
    Ok(diff_text)
}
