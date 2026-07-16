use git::commit::CommitGraphNode;
use git::repository::RepoInfo;
use git::status::FileStatus;

fn not_found(e: &git::error::GitError) -> bool {
    matches!(e, git::error::GitError::NotFound(_))
}

#[tauri::command]
pub fn git_repo_info(path: String) -> Result<Option<RepoInfo>, String> {
    if path.is_empty() {
        return Ok(None);
    }
    match git::repository::repo_info(&path) {
        Ok(info) => Ok(Some(info)),
        Err(e) if not_found(&e) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn git_status(path: String) -> Result<Vec<FileStatus>, String> {
    if path.is_empty() {
        return Ok(Vec::new());
    }
    git::status::get_status(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_stage_file(path: String, file_path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::status::stage_file(&path, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_stage_all(path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::status::stage_all(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_unstage_file(path: String, file_path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::status::unstage_file(&path, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_revert_file(path: String, file_path: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::status::revert_file(&path, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commit(path: String, message: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }

    let repo = git::repository::open(&path).map_err(|e| e.to_string())?;
    let signature = git2::Signature::now("User", "user@example.com").map_err(|e| e.to_string())?;

    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_oid = index.write_tree_to(&repo).map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_oid).map_err(|e| e.to_string())?;

    let parent_commit = repo.head().ok().and_then(|h| h.target()).and_then(|oid| repo.find_commit(oid).ok());

    if let Some(pc) = parent_commit {
        repo.commit(Some("HEAD"), &signature, &signature, &message, &tree, &[&pc]).map_err(|e| e.to_string())?;
    } else {
        repo.commit(Some("HEAD"), &signature, &signature, &message, &tree, &[] as &[&git2::Commit])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn git_branches(path: String) -> Result<Vec<git::repository::BranchInfo>, String> {
    if path.is_empty() {
        return Ok(Vec::new());
    }
    let repo = git::repository::open(&path).map_err(|e| e.to_string())?;
    git::repository::list_branches(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commits(path: String, max_count: i32) -> Result<Vec<git::commit::CommitInfo>, String> {
    if path.is_empty() {
        return Ok(Vec::new());
    }
    git::commit::get_commits(&path, max_count).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_graph(path: String, max_count: i32) -> Result<Vec<CommitGraphNode>, String> {
    if path.is_empty() {
        return Ok(Vec::new());
    }
    git::commit::build_graph(&path, max_count).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_publish_branch(path: String, branch: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::repository::publish_branch(&path, &branch).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_current_branch(path: String) -> Result<Option<String>, String> {
    if path.is_empty() {
        return Ok(None);
    }
    let repo = git::repository::open(&path).map_err(|e| e.to_string())?;
    git::repository::get_current_branch(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commit_details(path: String, oid: String) -> Result<git::commit::CommitInfo, String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::commit::get_commit_details(&path, &oid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commit_files(path: String, oid: String) -> Result<Vec<git::commit::CommitFile>, String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::commit::get_commit_files(&path, &oid).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_checkout_branch(path: String, name: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::branch::checkout_branch(&path, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_create_branch(path: String, name: String) -> Result<(), String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::branch::create_branch(&path, &name).map_err(|e| e.to_string())
}

