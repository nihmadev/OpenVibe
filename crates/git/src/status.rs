use git2::{Status, StatusEntry, StatusOptions};
use serde::Serialize;

use crate::error::Result;
use crate::repository::open;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub original_path: Option<String>,
    pub status: String,
    pub staged: bool,
    pub index_status: String,
    pub worktree_status: String,
}

pub fn get_status(path: &str) -> Result<Vec<FileStatus>> {
    let repo = open(path)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_unmodified(false)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut files = Vec::new();

    for entry in statuses.iter() {
        let file = entry_to_file_status(&entry)?;
        files.push(file);
    }

    Ok(files)
}

fn entry_to_file_status(entry: &StatusEntry) -> Result<FileStatus> {
    let path = entry.path().map(|s| s.to_string()).unwrap_or_default();
    let status = entry.status();

    let head_to_index = entry.head_to_index();
    let original_path = head_to_index
        .and_then(|d| d.old_file().path())
        .map(|p| p.to_string_lossy().to_string());

    let (index_status, worktree_status) = format_status_chars(status);
    let staged = status_has_flag(status, Status::INDEX_NEW)
        || status_has_flag(status, Status::INDEX_MODIFIED)
        || status_has_flag(status, Status::INDEX_DELETED)
        || status_has_flag(status, Status::INDEX_RENAMED)
        || status_has_flag(status, Status::INDEX_TYPECHANGE);

    let status_str = if staged && !worktree_only(status) {
        format!("{}{}", index_status, worktree_status)
    } else if staged {
        index_status.clone()
    } else {
        worktree_status.clone()
    };

    Ok(FileStatus {
        path,
        original_path,
        status: status_str,
        staged,
        index_status,
        worktree_status,
    })
}

fn status_has_flag(status: Status, flag: Status) -> bool {
    (status.bits() & flag.bits()) != 0
}

fn worktree_only(status: Status) -> bool {
    !status_has_flag(status, Status::INDEX_NEW)
        && !status_has_flag(status, Status::INDEX_MODIFIED)
        && !status_has_flag(status, Status::INDEX_DELETED)
        && !status_has_flag(status, Status::INDEX_RENAMED)
        && !status_has_flag(status, Status::INDEX_TYPECHANGE)
}

fn format_status_chars(status: Status) -> (String, String) {
    let index = if status_has_flag(status, Status::INDEX_NEW) {
        "A"
    } else if status_has_flag(status, Status::INDEX_MODIFIED) {
        "M"
    } else if status_has_flag(status, Status::INDEX_DELETED) {
        "D"
    } else if status_has_flag(status, Status::INDEX_RENAMED) {
        "R"
    } else if status_has_flag(status, Status::INDEX_TYPECHANGE) {
        "T"
    } else {
        " "
    };

    let worktree = if status_has_flag(status, Status::WT_NEW) {
        "?"
    } else if status_has_flag(status, Status::WT_MODIFIED) {
        "M"
    } else if status_has_flag(status, Status::WT_DELETED) {
        "D"
    } else if status_has_flag(status, Status::WT_RENAMED) {
        "R"
    } else if status_has_flag(status, Status::WT_TYPECHANGE) {
        "T"
    } else {
        " "
    };

    let (i, w) =
        if status_has_flag(status, Status::WT_NEW) && !status_has_flag(status, Status::INDEX_NEW) {
            ("?", "?")
        } else {
            (index, worktree)
        };

    (i.to_string(), w.to_string())
}

pub fn stage_file(path: &str, file_path: &str) -> Result<()> {
    let repo = open(path)?;
    let mut index = repo.index()?;
    index.add_path(std::path::Path::new(file_path))?;
    index.write()?;
    Ok(())
}

pub fn stage_all(path: &str) -> Result<()> {
    let repo = open(path)?;
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

pub fn unstage_file(path: &str, file_path: &str) -> Result<()> {
    let repo = open(path)?;
    let mut index = repo.index()?;
    index.remove_path(std::path::Path::new(file_path))?;
    index.write()?;
    Ok(())
}

pub fn unstage_all(path: &str) -> Result<()> {
    let repo = open(path)?;
    if let Ok(head) = repo.head() {
        if let Ok(tree) = head.peel_to_tree() {
            let mut index = repo.index()?;
            index.read_tree(&tree)?;
            index.write()?;
        }
    }
    Ok(())
}

pub fn revert_file(path: &str, file_path: &str) -> Result<()> {
    let repo = open(path)?;
    let head = repo.head()?;
    let head_tree = head.peel_to_tree()?;
    let entry = head_tree.get_path(std::path::Path::new(file_path))?;
    let blob = repo.find_blob(entry.id())?;
    let content = blob.content();
    let full_path = std::path::Path::new(path).join(file_path);
    if let Some(parent_dir) = full_path.parent() {
        std::fs::create_dir_all(parent_dir)?;
    }
    std::fs::write(&full_path, content)?;
    Ok(())
}

pub fn get_file_diff(path: &str, file_path: &str) -> Result<String> {
    let repo = open(path)?;
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let mut opts = git2::DiffOptions::new();
    opts.pathspec(file_path);
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
