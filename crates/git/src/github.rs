use crate::error::{GitError, Result};
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubProfile {
    pub login: String,
    pub name: Option<String>,
    pub bio: Option<String>,
    pub public_repos: u32,
    pub followers: u32,
    pub following: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubRepo {
    pub name: String,
    pub full_name: String,
    pub private: bool,
    pub html_url: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubBranch {
    pub name: String,
    pub protected: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubCommit {
    pub sha: String,
    pub commit: CommitDetail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetail {
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubPullRequest {
    pub title: String,
    pub state: String,
    pub number: u64,
    pub html_url: String,
}

pub fn get_profile() -> Result<GitHubProfile> {
    let output = Command::new("gh")
        .args(["api", "user"])
        .output()
        .map_err(|e| GitError::Other(e.to_string()))?;

    if !output.status.success() {
        return Err(GitError::Other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let profile: GitHubProfile =
        serde_json::from_slice(&output.stdout).map_err(|e| GitError::Other(e.to_string()))?;
    Ok(profile)
}

pub fn list_repos() -> Result<Vec<GitHubRepo>> {
    let output = Command::new("gh")
        .args(["api", "user/repos"])
        .output()
        .map_err(|e| GitError::Other(e.to_string()))?;

    if !output.status.success() {
        return Err(GitError::Other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let repos: Vec<GitHubRepo> =
        serde_json::from_slice(&output.stdout).map_err(|e| GitError::Other(e.to_string()))?;
    Ok(repos)
}

pub fn get_branches(repo: &str) -> Result<Vec<GitHubBranch>> {
    let output = Command::new("gh")
        .args(["api", &format!("repos/{}/branches", repo)])
        .output()
        .map_err(|e| GitError::Other(e.to_string()))?;

    if !output.status.success() {
        return Err(GitError::Other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let branches: Vec<GitHubBranch> =
        serde_json::from_slice(&output.stdout).map_err(|e| GitError::Other(e.to_string()))?;
    Ok(branches)
}

pub fn get_github_commits(repo: &str) -> Result<Vec<GitHubCommit>> {
    let output = Command::new("gh")
        .args(["api", &format!("repos/{}/commits", repo)])
        .output()
        .map_err(|e| GitError::Other(e.to_string()))?;

    if !output.status.success() {
        return Err(GitError::Other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let commits: Vec<GitHubCommit> =
        serde_json::from_slice(&output.stdout).map_err(|e| GitError::Other(e.to_string()))?;
    Ok(commits)
}

pub fn get_pull_requests(repo: &str, state: &str) -> Result<Vec<GitHubPullRequest>> {
    let output = Command::new("gh")
        .args(["api", &format!("repos/{}/pulls?state={}", repo, state)])
        .output()
        .map_err(|e| GitError::Other(e.to_string()))?;

    if !output.status.success() {
        return Err(GitError::Other(
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    let prs: Vec<GitHubPullRequest> =
        serde_json::from_slice(&output.stdout).map_err(|e| GitError::Other(e.to_string()))?;
    Ok(prs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_profile() {
        let profile = get_profile();
        assert!(
            profile.is_ok(),
            "Failed to get profile: {:?}",
            profile.err()
        );
        let profile = profile.unwrap();
        assert!(
            !profile.login.is_empty(),
            "Profile login should not be empty"
        );
    }

    #[test]
    fn test_list_repos() {
        let repos = list_repos();
        assert!(repos.is_ok(), "Failed to list repos: {:?}", repos.err());
        let repos = repos.unwrap();
        // Since gh is logged in, we expect at least one repo (or zero if none, but usually some).
        println!("Repos found: {}", repos.len());
    }

    #[test]
    fn test_get_branches() {
        // Use the current repo for test
        let repo_name = "nihmadev/OpenVibe";
        let branches = get_branches(repo_name);
        assert!(
            branches.is_ok(),
            "Failed to get branches: {:?}",
            branches.err()
        );
        let branches = branches.unwrap();
        assert!(!branches.is_empty(), "Expected at least one branch");
        assert!(
            branches
                .iter()
                .any(|b| b.name == "main" || b.name == "master"),
            "Expected main or master branch"
        );
    }

    #[test]
    fn test_get_github_commits() {
        let repo_name = "nihmadev/OpenVibe";
        let commits = get_github_commits(repo_name);
        assert!(
            commits.is_ok(),
            "Failed to get commits: {:?}",
            commits.err()
        );
        let commits = commits.unwrap();
        assert!(!commits.is_empty(), "Expected at least one commit");
    }

    #[test]
    fn test_get_pull_requests() {
        let repo_name = "nihmadev/OpenVibe";
        let prs = get_pull_requests(repo_name, "all");
        assert!(prs.is_ok(), "Failed to get PRs: {:?}", prs.err());
    }
}
