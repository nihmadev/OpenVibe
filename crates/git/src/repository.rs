use serde::Serialize;

use crate::error::Result;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub name: String,
    pub path: String,
    pub current_branch: Option<String>,
    pub branches: Vec<BranchInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BranchInfo {
    pub name: String,
    pub is_current: bool,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
}

pub fn open(path: &str) -> Result<git2::Repository> {
    crate::discover(path)
}

pub fn repo_info(path: &str) -> Result<RepoInfo> {
    let repo = open(path)?;
    let name = repo
        .workdir()
        .and_then(|p| p.file_name())
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let current_branch = get_current_branch(&repo)?;
    let branches = list_branches(&repo)?;

    Ok(RepoInfo {
        name,
        path: path.to_string(),
        current_branch,
        branches,
    })
}

pub fn get_current_branch(repo: &git2::Repository) -> Result<Option<String>> {
    let head = repo.head().ok();
    match head {
        Some(reference) => {
            if reference.is_branch() {
                reference
                    .shorthand()
                    .map(|s| Some(s.to_string()))
                    .ok_or_else(|| crate::error::GitError::Other("Invalid branch name".into()))
            } else {
                Ok(None)
            }
        }
        None => Ok(None),
    }
}

pub fn list_branches(repo: &git2::Repository) -> Result<Vec<BranchInfo>> {
    let current = get_current_branch(repo)?;
    let mut branches = Vec::new();

    let mut git_branches = repo.branches(Some(git2::BranchType::Local))?;
    while let Some(Ok((branch, _))) = git_branches.next() {
        let name = branch
            .name()
            .ok()
            .flatten()
            .map(|s| s.to_string())
            .unwrap_or_default();

        let is_current = current.as_deref() == Some(&name);

        let (ahead, behind) = if let Ok(upstream) = branch.upstream() {
            match (branch.get().target(), upstream.get().target()) {
                (Some(b_oid), Some(u_oid)) => {
                    repo.graph_ahead_behind(b_oid, u_oid).unwrap_or((0, 0))
                }
                _ => (0, 0),
            }
        } else {
            (0, 0)
        };

        let upstream = branch.upstream().ok().and_then(|u| {
            u.name()
                .ok()
                .flatten()
                .map(|s| format!("origin/{}", s.trim_start_matches("refs/heads/")))
        });

        branches.push(BranchInfo {
            name,
            is_current,
            upstream,
            ahead,
            behind,
        });
    }

    branches.sort_by(|a, b| {
        if a.is_current {
            std::cmp::Ordering::Less
        } else if b.is_current {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });

    Ok(branches)
}

pub fn publish_branch(path: &str, branch: &str) -> Result<()> {
    let repo = open(path)?;
    let mut remote = repo.find_remote("origin")?;
    let branch_ref = format!("refs/heads/{}", branch);
    let mut push_opts = git2::PushOptions::new();
    remote.push(
        &[&format!("{}:refs/heads/{}", branch_ref, branch)],
        Some(&mut push_opts),
    )?;
    Ok(())
}
