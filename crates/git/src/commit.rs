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
    pub author_avatar: Option<String>,
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
    pub author_avatar: Option<String>,
    pub time: i64,
    pub parent_ids: Vec<String>,
    pub branch_names: Vec<String>,
    pub column: usize,
    pub ref_names: Vec<String>,
    pub is_head: bool,
    pub is_merge: bool,
    pub lanes: Vec<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitFile {
    pub path: String,
    pub status: String,
    pub old_path: Option<String>,
    #[serde(default)]
    pub additions: i32,
    #[serde(default)]
    pub deletions: i32,
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

fn get_avatar_url(email: &str, name: &str) -> Option<String> {
    if email.contains("@users.noreply.github.com") {
        let username = email.split('+').nth(1)
            .and_then(|s| s.split('@').next())
            .or_else(|| email.split('@').next());
        return username.map(|u| format!("https://github.com/{}.png?size=40", u));
    }

    let name_trimmed = name.trim();
    if !name_trimmed.contains(' ') && !name_trimmed.is_empty() {
        return Some(format!("https://github.com/{}.png?size=40", name_trimmed));
    }

    let hash = md5::compute(email.trim().to_lowercase().as_bytes());
    Some(format!("https://www.gravatar.com/avatar/{:x}?s=40&d=retro", hash))
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
    let author_avatar = get_avatar_url(&author_email, &author_name);
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
        author_avatar,
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

pub fn get_commit_files(path: &str, oid: &str) -> Result<Vec<CommitFile>> {
    let repo = open(path)?;
    let oid = Oid::from_str(oid).map_err(|e| crate::error::GitError::Other(e.to_string()))?;
    let commit = repo.find_commit(oid)?;

    let mut files = Vec::new();
    let commit_tree = commit.tree()?;

    let parent_tree = if commit.parent_count() > 0 {
        Some(commit.parent(0)?.tree()?)
    } else {
        None
    };

    let diff = repo.diff_tree_to_tree(
        parent_tree.as_ref(),
        Some(&commit_tree),
        None
    )?;

    for (i, delta) in diff.deltas().enumerate() {
        let status = match delta.status() {
            git2::Delta::Added => "A",
            git2::Delta::Modified => "M",
            git2::Delta::Deleted => "D",
            git2::Delta::Renamed => "R",
            git2::Delta::Copied => "C",
            _ => "M",
        };

        let path = delta.new_file().path()
            .or(delta.old_file().path())
            .and_then(|p| p.to_str())
            .unwrap_or("")
            .to_string();

        let old_path = if delta.status() == git2::Delta::Renamed {
            delta.old_file().path().and_then(|p| p.to_str()).map(|s| s.to_string())
        } else {
            None
        };

        let mut additions = 0;
        let mut deletions = 0;
        if let Ok(Some(patch)) = git2::Patch::from_diff(&diff, i) {
            if let Ok((_, add, del)) = patch.line_stats() {
                additions = add as i32;
                deletions = del as i32;
            }
        }

        files.push(CommitFile {
            path,
            status: status.to_string(),
            old_path,
            additions,
            deletions,
        });
    }

    Ok(files)
}

pub fn build_graph(path: &str, max_count: i32) -> Result<Vec<CommitGraphNode>> {
    let repo = open(path)?;
    let head = repo.head().ok();

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(Sort::TIME | Sort::TOPOLOGICAL)?;

    let _ = revwalk.push_head();
    let _ = revwalk.push_glob("refs/heads/*");
    let _ = revwalk.push_glob("refs/remotes/*");

    let mut commits: Vec<CommitGraphNode> = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let mut oid_list: Vec<Oid> = Vec::new();

    for oid_result in revwalk {
        let oid = match oid_result {
            Ok(o) => o,
            Err(_) => continue,
        };
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

    // Track active lanes for column assignment
    let mut active_lanes: Vec<Option<Oid>> = Vec::new();

    for &oid in &oid_list {
        let commit = match repo.find_commit(oid) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let parents: Vec<Oid> = commit.parents().map(|p| p.id()).collect();
        let is_merge = parents.len() > 1;

        // Determine column for current commit
        let lane_idx = active_lanes.iter().position(|lane| *lane == Some(oid));
        let column = match lane_idx {
            Some(idx) => {
                active_lanes[idx] = if !parents.is_empty() { Some(parents[0]) } else { None };
                idx
            }
            None => {
                let empty_idx = active_lanes.iter().position(|l| l.is_none());
                let col = match empty_idx {
                    Some(idx) => {
                        active_lanes[idx] = if !parents.is_empty() { Some(parents[0]) } else { None };
                        idx
                    }
                    None => {
                        active_lanes.push(if !parents.is_empty() { Some(parents[0]) } else { None });
                        active_lanes.len() - 1
                    }
                };
                col
            }
        };

        // Handle remaining merge parents
        for &parent in parents.iter().skip(1) {
            if !active_lanes.contains(&Some(parent)) {
                if let Some(empty_idx) = active_lanes.iter().position(|l| l.is_none()) {
                    active_lanes[empty_idx] = Some(parent);
                } else {
                    active_lanes.push(Some(parent));
                }
            }
        }

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
        let author_avatar = get_avatar_url(&author_email, &author);
        let time = commit.time().seconds();

        let parent_ids: Vec<String> = parents.iter().map(|o| o.to_string()).collect();

        commits.push(CommitGraphNode {
            id: oid.to_string(),
            short_id,
            message,
            summary,
            author,
            author_email,
            author_avatar,
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

pub fn commit(path: &str, message: &str) -> Result<String> {
    let repo = open(path)?;
    
    let mut index = repo.index()?;
    let oid = index.write_tree()?;
    let tree = repo.find_tree(oid)?;

    let parent_commit = repo.head().ok().and_then(|h| h.peel_to_commit().ok());

    let signature = repo
        .signature()
        .or_else(|_| git2::Signature::now("Unknown", "unknown@example.com"))?;

    let mut parents = Vec::new();
    if let Some(ref p) = parent_commit {
        parents.push(p);
    }
    
    let commit_id = repo.commit(
        Some("HEAD"),
        &signature,
        &signature,
        message,
        &tree,
        &parents,
    )?;

    Ok(commit_id.to_string())
}
