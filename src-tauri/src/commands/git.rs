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

#[tauri::command]
pub fn git_file_content(path: String, file_path: String, ref_name: String) -> Result<String, String> {
    if path.is_empty() {
        return Err("No project open".into());
    }
    git::status::get_file_content_at_ref(&path, &file_path, &ref_name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn generate_commit_message(state: tauri::State<'_, crate::AppState>, path: String) -> Result<String, String> {
    if path.is_empty() {
        return Err("No project open".into());
    }

    let diff_text = git::diff::get_staged_diff_text(&path).map_err(|e| e.to_string())?;
    if diff_text.trim().is_empty() {
        return Err("No staged changes found".into());
    }

    let mut cfg = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock.as_ref().cloned().unwrap_or_else(|| config::Config {
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o-mini".to_string(),
            cwd: path.clone(),
            auto_approve: false,
            provider_id: None,
            api_url: Some("https://api.nihmadev.fun".to_string()),
            reasoning_effort: None,
        })
    };

    let use_proxy = state
        .projects
        .lock()
        .map_err(|e| e.to_string())
        .and_then(|p| p.get_state("settings:useRegionalProxy").map_err(|e| e.to_string()))
        .unwrap_or(Some("true".to_string()))
        .unwrap_or_else(|| "true".to_string());

    if use_proxy != "true" {
        cfg.api_url = None;
    }

    let llm_config = cfg.to_agent_config().llm_config();
    let cancel = std::sync::atomic::AtomicBool::new(false);
    // Reuse the shared pooled client: a fresh Client here paid a full
    // DNS + TCP + TLS handshake on every commit-message generation.
    let client = state.http_client.clone();

    let system_prompt = "You are an expert Git commit message generator. Analyze the provided git diff of staged changes and generate a concise conventional commit message (e.g. feat(scope): message, fix(scope): message, docs: message, etc.).\nRULES:\n1. Return ONLY the raw commit message text.\n2. Do NOT wrap in markdown backticks or code blocks.\n3. Do NOT add explanation, greetings, or conversation.\n4. Keep the title line concise (under 72 chars).";

    // Truncate diff_text if extremely long to avoid context overflow
    let max_diff_len = 15000;
    let truncated_diff = if diff_text.len() > max_diff_len {
        format!("{}\n...[diff truncated]", &diff_text[..max_diff_len])
    } else {
        diff_text
    };

    let messages = vec![
        agent::ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system_prompt.to_string())),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        },
        agent::ChatMessage {
            role: "user".to_string(),
            content: Some(serde_json::Value::String(format!("Here is the git diff:\n\n{}", truncated_diff))),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        },
    ];

    let turn = agent::request::stream_chat(
        &llm_config,
        messages,
        Vec::new(),
        &cancel,
        &client,
        &|_| {},
        &|_| {},
        &|_| {},
        &|| {},
        &|_, _| {},
    )
    .await?;

    let mut message = turn.content.trim().to_string();
    if message.starts_with("```") {
        message =
            message.trim_start_matches("```").trim_start_matches("text").trim_start_matches("markdown").to_string();
        if let Some(idx) = message.rfind("```") {
            message = message[..idx].to_string();
        }
        message = message.trim().to_string();
    }

    Ok(message)
}
