use git2::{Oid, Sort};
use serde::Serialize;

use crate::error::Result;
use crate::repository::open;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub summary: String,
    pub author: String,
    pub author_email: String,
    pub time: i64,
    pub parent_ids: Vec<String>,
    pub branch_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitGraphNode {
    pub id: String,
    pub short_id: String,
    pub message: String,
    pub summary: String,
    pub author: String,
    pub author_email: String,
    pub time: i64,
    pub parent_ids: Vec<String>,
    pub branch_names: Vec<String>,
    pub column: usize,
    pub ref_names: Vec<String>,
    pub is_head: bool,
    pub is_merge: bool,
    pub lanes: Vec<usize>,
}

pub fn get_commits(path: &str, max_count: i32) -> Result<Vec<CommitInfo>> {
    let repo = open(path)?;
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME)?;
    revwalk.push_head()?;
    let mut commits = Vec::new();

    for (_, oid) in revwalk.enumerate().take(max_count as usize) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        commits.push(commit_to_info(&repo, &commit)?);
    }

    Ok(commits)
}

pub fn get_branch_commits(path: &str, branch: &str, max_count: i32) -> Result<Vec<CommitInfo>> {
    let repo = open(path)?;
    let branch_ref = repo.find_branch(branch, git2::BranchType::Local)?;
    let branch_oid = branch_ref
        .get()
        .target()
        .ok_or_else(|| crate::error::GitError::Other("Branch has no target".into()))?;
    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME)?;
    revwalk.push(branch_oid)?;
    let mut commits = Vec::new();

    for (_, oid) in revwalk.enumerate().take(max_count as usize) {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        commits.push(commit_to_info(&repo, &commit)?);
    }

    Ok(commits)
}

fn commit_to_info(repo: &git2::Repository, commit: &git2::Commit) -> Result<CommitInfo> {
    let id = commit.id().to_string();
    let short_id = commit
        .as_object()
        .short_id()
        .ok()
        .and_then(|buf| buf.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| id[..7].to_string());

    let message = commit.message().unwrap_or("").to_string();
    let summary = commit.summary().unwrap_or("").to_string();
    let author = commit.author();
    let author_name = author.name().unwrap_or("unknown").to_string();
    let author_email = author.email().unwrap_or("").to_string();
    let time = commit.time().seconds();

    let parent_ids: Vec<String> = commit.parents().map(|p| p.id().to_string()).collect();

    let branch_names = find_branches_for_commit(repo, commit.id())?;

    Ok(CommitInfo {
        id,
        short_id,
        message,
        summary,
        author: author_name,
        author_email,
        time,
        parent_ids,
        branch_names,
    })
}

fn find_branches_for_commit(repo: &git2::Repository, oid: Oid) -> Result<Vec<String>> {
    let mut names = Vec::new();
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
        for branch in branches.flatten() {
            if let Some(target) = branch.0.get().target() {
                if target == oid {
                    if let Some(name) = branch.0.name().ok().flatten() {
                        names.push(name.to_string());
                    }
                }
            }
        }
    }
    Ok(names)
}

pub fn get_commit_details(path: &str, oid: &str) -> Result<CommitInfo> {
    let repo = open(path)?;
    let oid = Oid::from_str(oid).map_err(|e| crate::error::GitError::Other(e.to_string()))?;
    let commit = repo.find_commit(oid)?;
    commit_to_info(&repo, &commit)
}

pub fn build_graph(path: &str, max_count: i32) -> Result<Vec<CommitGraphNode>> {
    let repo = open(path)?;
    let head = repo.head().ok();

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)?;

    if let Some(ref h) = head {
        if let Some(target) = h.target() {
            revwalk.push(target)?;
        }
    }

    let mut commits: Vec<CommitGraphNode> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut oid_list: Vec<Oid> = Vec::new();

    for oid_result in revwalk {
        let oid = oid_result?;
        if seen.contains(&oid) {
            continue;
        }
        seen.insert(oid);
        oid_list.push(oid);
        if oid_list.len() >= max_count as usize {
            break;
        }
    }

    let all_refs: Vec<(String, Oid)> = {
        let mut refs = Vec::new();
        if let Ok(branches) = repo.branches(Some(git2::BranchType::Local)) {
            for branch in branches.flatten() {
                if let Some(name) = branch.0.name().ok().flatten() {
                    if let Some(target) = branch.0.get().target() {
                        refs.push((name.to_string(), target));
                    }
                }
            }
        }
        if let Ok(branches) = repo.branches(Some(git2::BranchType::Remote)) {
            for branch in branches.flatten() {
                if let Some(name) = branch.0.name().ok().flatten() {
                    if let Some(target) = branch.0.get().target() {
                        refs.push((name.to_string(), target));
                    }
                }
            }
        }
        refs
    };

    let head_oid = head.as_ref().and_then(|h| h.target());

    for &oid in &oid_list {
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let parents: Vec<Oid> = commit.parents().map(|p| p.id()).collect();
        let is_merge = parents.len() > 1;

        let column = 0;

        let branch_names: Vec<String> = all_refs
            .iter()
            .filter(|(_, ref_oid)| *ref_oid == oid)
            .map(|(name, _)| name.clone())
            .collect();

        let ref_names: Vec<String> = all_refs
            .iter()
            .filter(|(_, ref_oid)| *ref_oid == oid)
            .map(|(name, _)| {
                if name.starts_with("refs/heads/") {
                    name.trim_start_matches("refs/heads/").to_string()
                } else if name.starts_with("refs/remotes/") {
                    name.trim_start_matches("refs/remotes/").to_string()
                } else {
                    name.clone()
                }
            })
            .collect();

        let is_head = head_oid.map(|h| h == oid).unwrap_or(false);

        let short_id = commit
            .as_object()
            .short_id()
            .ok()
            .and_then(|buf| buf.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| oid.to_string()[..7].to_string());
        let message = commit.message().unwrap_or("").to_string();
        let summary = commit.summary().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("unknown").to_string();
        let author_email = commit.author().email().unwrap_or("").to_string();
        let time = commit.time().seconds();

        let parent_ids: Vec<String> = parents.iter().map(|o| o.to_string()).collect();

        commits.push(CommitGraphNode {
            id: oid.to_string(),
            short_id,
            message,
            summary,
            author,
            author_email,
            time,
            parent_ids,
            branch_names,
            column,
            ref_names,
            is_head,
            is_merge,
            lanes: Vec::new(),
        });
    }

    Ok(commits)
}
