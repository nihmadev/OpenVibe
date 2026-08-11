use std::sync::atomic::Ordering;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

use crate::AppState;
use agent::chat::ChatMessage;
use agent::snapshot::{AgentFileChange, RollbackPreview, SnapshotEntry};
use agent::sub_trace::{get_sub_trace, SubTraceEvent};
use agent::Agent;
use config::Config;

fn persist_agent_chat_state(
    state: &AppState,
    messages: Vec<ChatMessage>,
    file_snapshots: Vec<SnapshotEntry>,
) -> Result<(), String> {
    let active_id = state.active_chat_id.lock().map_err(|e| e.to_string())?.clone();
    let Some(active_id) = active_id else {
        return Ok(());
    };
    let mut chat_store = state.chat_store.lock().map_err(|e| e.to_string())?;
    let Some(store) = chat_store.as_mut() else {
        return Ok(());
    };
    if let Some(mut record) = store.get(&active_id).map_err(|e| e.to_string())? {
        record.messages = messages;
        record.file_snapshots = file_snapshots;
        record.updated_at = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
        store.save(&record).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_new(state: State<'_, AppState>, cwd: String) -> Result<(), String> {
    let mut cfg = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock.as_ref().cloned().unwrap_or_else(|| Config {
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o-mini".to_string(),
            cwd: cwd.clone(),
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

    let agent_cfg = cfg.to_agent_config();
    let agent = Agent::new(agent_cfg);
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    *agent_lock = Some(agent);
    Ok(())
}

/// Update the agent's control-plane todo state without creating a user prompt.
/// If a generation is active, the state is queued and applied before its next send.
#[tauri::command]
pub async fn agent_update_todo(state: State<'_, AppState>, context: String) -> Result<(), String> {
    {
        let mut pending = state.todo_context.lock().map_err(|e| e.to_string())?;
        *pending = Some(context.clone());
    }
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(agent) = agent_lock.as_mut() {
        agent.set_todo_context(Some(context));
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_send(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    input: String,
    content_parts: Option<Vec<serde_json::Value>>,
) -> Result<(), String> {
    // Extract cancel flag from agent BEFORE taking it out, so agent_stop can still cancel
    let cancel_token = {
        let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
        agent_lock.as_ref().map(|a| a.cancel.clone())
    };
    {
        let mut cancel_lock = state.agent_cancel.lock().map_err(|e| e.to_string())?;
        *cancel_lock = cancel_token;
    }

    let mut agent = {
        let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
        agent_lock.take()
    }
    .ok_or_else(|| "No agent created yet. Call agent_new first.".to_string())?;

    if let Some(todo) = state.todo_context.lock().map_err(|e| e.to_string())?.clone() {
        agent.set_todo_context(Some(todo));
    }

    let executor = agent_tool::AgentToolExecutor::with_mcp(state.mcp_manager.clone());

    let emit = |event: &str, data: serde_json::Value| {
        let _ = app_handle.emit(event, data);
    };

    // 1. Add user message & emit immediately so UI shows it right away
    agent.add_user_message(input.clone(), content_parts, &emit);

    // 2. Save chat state
    {
        let msgs = agent.messages.clone();
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
        let active = state.active_chat_id.lock().map_err(|e| e.to_string())?;
        if let Some(ref id) = *active {
            let mut chat_store = state.chat_store.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut store) = *chat_store {
                if let Ok(Some(mut record)) = store.get(id) {
                    record.messages = msgs.clone();
                    record.file_snapshots = agent.file_snapshots.clone();
                    record.updated_at = ts;
                    let _ = store.save(&record);
                }
            }
        }
        let app = state.app_handle.lock().map_err(|e| e.to_string())?;
        if let Some(ref handle) = *app {
            let _ = handle.emit("vibe:chats:updated", ());
        }
    }

    agent.send(&executor, &state.http_client, &emit).await;

    // The agent is temporarily removed from AppState while a request runs.
    // A project switch can therefore update the shared config while
    // agent_set_cwd cannot reach this instance. Reconcile before putting it
    // back so the next request cannot use the previous project's cwd.
    let current_cwd = state.config.lock().map_err(|e| e.to_string())?.as_ref().map(|config| config.cwd.clone());
    if let Some(current_cwd) = current_cwd {
        if current_cwd != agent.config().cwd {
            agent.set_cwd(current_cwd);
        }
    }

    // Clean up cancel token now that send is done
    {
        let mut cancel_lock = state.agent_cancel.lock().map_err(|e| e.to_string())?;
        *cancel_lock = None;
    }

    let (needs_title, active_id, db_path, agent_cfg, msgs, language) = {
        let msgs = agent.messages.clone();
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
        let active = state.active_chat_id.lock().map_err(|e| e.to_string())?;
        let mut is_new = false;
        let mut cur_id = None;
        let mut db_p = None;

        if let Some(ref id) = *active {
            cur_id = Some(id.clone());
            let mut chat_store = state.chat_store.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut store) = *chat_store {
                if let Ok(Some(mut record)) = store.get(id) {
                    is_new = record.title == "New chat" || record.title.trim().is_empty();
                    record.messages = msgs.clone();
                    record.file_snapshots = agent.file_snapshots.clone();
                    record.updated_at = ts;
                    let _ = store.save(&record);
                }
            }
            drop(chat_store);
            if let Ok(projects) = state.projects.lock() {
                if let Ok(Some(active_proj)) = projects.get_active() {
                    db_p = Some(projects.chats_db(&active_proj.id));
                }
            }
        }
        drop(active);
        let language = state
            .projects
            .lock()
            .ok()
            .and_then(|p| p.get_state("settings:language").ok().flatten())
            .unwrap_or_else(|| "Russian".to_string());
        let app = state.app_handle.lock().map_err(|e| e.to_string())?;
        if let Some(ref handle) = *app {
            let _ = handle.emit("vibe:chats:updated", ());
        }
        (is_new, cur_id, db_p, agent.config().clone(), msgs, language)
    };

    if needs_title {
        if let (Some(chat_id), Some(db_path)) = (active_id, db_path) {
            let http_client = state.http_client.clone();
            let app_handle_clone = app_handle.clone();
            tokio::spawn(async move {
                let title = Agent::summarize_with(agent_cfg, msgs, &language, &http_client).await;
                if !title.is_empty() && title != "New chat" {
                    if let Ok(mut store) = chats::ChatStore::new(&db_path) {
                        if let Ok(Some(mut record)) = store.get(&chat_id) {
                            if record.title == "New chat" || record.title.trim().is_empty() {
                                record.title = title;
                                let _ = store.save(&record);
                                let _ = app_handle_clone.emit("vibe:chats:updated", ());
                            }
                        }
                    }
                }
            });
        }
    }

    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    *agent_lock = Some(agent);
    drop(agent_lock);

    // Publish the idle state only after the agent, including its file snapshots,
    // is available to commands opened from the completed run UI.
    let _ = app_handle.emit("vibe:agent:busy", serde_json::json!({"busy": false}));
    let _ = app_handle.emit("vibe:agent:send-complete", ());

    Ok(())
}

#[tauri::command]
pub async fn agent_stop(state: State<'_, AppState>) -> Result<(), String> {
    // Always set the cancel token first — during active generation the agent is
    // taken out of state, so only the stashed cancel Arc is reachable.
    if let Ok(cancel_lock) = state.agent_cancel.lock() {
        if let Some(ref cancel) = *cancel_lock {
            cancel.store(true, Ordering::Relaxed);
        }
    }
    // Also try the agent directly (covers the case when it is idle in state)
    if let Ok(agent_lock) = state.agent.lock() {
        if let Some(ref agent) = *agent_lock {
            agent.stop();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_reset(state: State<'_, AppState>) -> Result<(), String> {
    *state.todo_context.lock().map_err(|e| e.to_string())? = None;
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        agent.reset();
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_summarize(state: State<'_, AppState>) -> Result<String, String> {
    let (messages, cfg) = {
        let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
        let agent = agent_lock.as_ref().ok_or_else(|| "No agent".to_string())?;
        (agent.get_messages().to_vec(), agent.config().clone())
    };

    let language = state
        .projects
        .lock()
        .ok()
        .and_then(|p| p.get_state("settings:language").ok().flatten())
        .unwrap_or_else(|| "Russian".to_string());
    let title = Agent::summarize_with(cfg, messages, &language, &state.http_client).await;

    Ok(title)
}

#[tauri::command]
pub async fn agent_set_messages(state: State<'_, AppState>, messages: Vec<ChatMessage>) -> Result<(), String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        agent.set_messages(messages);
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_set_chat_state(
    state: State<'_, AppState>,
    messages: Vec<ChatMessage>,
    file_snapshots: Vec<SnapshotEntry>,
) -> Result<(), String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        agent.set_chat_state(messages, file_snapshots);
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_get_messages(state: State<'_, AppState>) -> Result<Vec<ChatMessage>, String> {
    let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_ref().ok_or_else(|| "No agent".to_string())?;
    Ok(agent.get_messages().to_vec())
}

#[tauri::command]
pub async fn agent_get_sub_trace(call_id: String) -> Vec<SubTraceEvent> {
    get_sub_trace(&call_id)
}

#[tauri::command]
pub async fn agent_revert_preview(state: State<'_, AppState>, index: usize) -> Result<RollbackPreview, String> {
    let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_ref().ok_or_else(|| "No agent".to_string())?;
    Ok(agent.prepare_revert(index))
}

#[tauri::command]
pub async fn agent_instant_revert(state: State<'_, AppState>, index: usize) -> Result<RollbackPreview, String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_mut().ok_or_else(|| "No agent".to_string())?;
    let result = agent.instant_revert(index)?;
    let messages = agent.messages.clone();
    let file_snapshots = agent.file_snapshots.clone();
    drop(agent_lock);
    persist_agent_chat_state(&state, messages, file_snapshots)?;
    Ok(result)
}

#[tauri::command]
pub async fn agent_revert_undo(state: State<'_, AppState>) -> Result<(), String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_mut().ok_or_else(|| "No agent".to_string())?;
    agent.undo_revert()?;
    let messages = agent.messages.clone();
    let file_snapshots = agent.file_snapshots.clone();
    drop(agent_lock);
    persist_agent_chat_state(&state, messages, file_snapshots)
}

#[tauri::command]
pub async fn agent_file_change(state: State<'_, AppState>, tool_call_id: String) -> Result<AgentFileChange, String> {
    let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_ref().ok_or_else(|| "No agent".to_string())?;
    agent.get_file_change(&tool_call_id)
}

#[tauri::command]
pub async fn agent_accept_file_change(
    state: State<'_, AppState>,
    tool_call_id: String,
) -> Result<AgentFileChange, String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_mut().ok_or_else(|| "No agent".to_string())?;
    let result = agent.accept_file_change(&tool_call_id)?;
    let messages = agent.messages.clone();
    let file_snapshots = agent.file_snapshots.clone();
    drop(agent_lock);
    persist_agent_chat_state(&state, messages, file_snapshots)?;
    Ok(result)
}

#[tauri::command]
pub async fn agent_reject_file_change(
    state: State<'_, AppState>,
    tool_call_id: String,
) -> Result<AgentFileChange, String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_mut().ok_or_else(|| "No agent".to_string())?;
    let result = agent.reject_file_change(&tool_call_id)?;
    let messages = agent.messages.clone();
    let file_snapshots = agent.file_snapshots.clone();
    drop(agent_lock);
    persist_agent_chat_state(&state, messages, file_snapshots)?;
    Ok(result)
}

#[tauri::command]
pub async fn agent_set_cwd(state: State<'_, AppState>, cwd: String) -> Result<(), String> {
    *state.todo_context.lock().map_err(|e| e.to_string())? = None;

    // Keep the authoritative config in sync even when the agent is busy and
    // temporarily absent from AppState::agent.
    if let Some(config) = state.config.lock().map_err(|e| e.to_string())?.as_mut() {
        config.cwd = cwd.clone();
    }

    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        agent.set_cwd(cwd);
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_set_provider(
    state: State<'_, AppState>,
    api_key: String,
    base_url: String,
    model: String,
    provider_id: Option<String>,
) -> Result<(), String> {
    let mut warm_cfg: Option<config::Config> = None;
    if let Ok(mut config) = state.config.lock() {
        if let Some(ref mut c) = *config {
            c.api_key = api_key.clone();
            c.base_url = base_url.clone();
            c.model = model.clone();
            c.provider_id = provider_id.clone();
            warm_cfg = Some(c.clone());
        }
    }

    // Re-point the connection warmer at the new effective origin (proxy or
    // direct provider) and establish the connection right away so the first
    // message to the new provider skips the TLS handshake.
    if let Some(mut cfg) = warm_cfg {
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
        if let Some(origin) = agent::request::effective_origin(&cfg.to_agent_config().llm_config()) {
            state.warmer.set_origin(origin).await;
            let warmer = state.warmer.clone();
            tauri::async_runtime::spawn(async move {
                warmer.warm(std::time::Duration::from_secs(5)).await;
            });
        }
    }

    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        let cfg = agent.config_mut();
        cfg.api_key = api_key;
        cfg.base_url = base_url;
        cfg.model = model;
        cfg.provider_id = provider_id;
    }
    Ok(())
}
