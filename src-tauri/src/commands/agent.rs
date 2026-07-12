use std::sync::atomic::Ordering;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, State};

use crate::AppState;
use agent::chat::ChatMessage;
use agent::snapshot::RollbackPreview;
use agent::sub_trace::{get_sub_trace, SubTraceEvent};
use agent::Agent;
use config::Config;

#[tauri::command]
pub async fn agent_new(state: State<'_, AppState>, cwd: String) -> Result<(), String> {
    let cfg = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock.as_ref().cloned().unwrap_or_else(|| Config {
            api_key: String::new(),
            base_url: "https://api.openai.com/v1".to_string(),
            model: "gpt-4o-mini".to_string(),
            cwd: cwd.clone(),
            auto_approve: false,
            provider_id: None,
            api_url: Some("https://api.nihmadev.fun".to_string()),
        })
    };

    let agent_cfg = cfg.to_agent_config();
    let agent = Agent::new(agent_cfg);
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    *agent_lock = Some(agent);
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

    let mut confirm_senders = {
        let mut lock = state.pending_confirms.lock().map_err(|e| e.to_string())?;
        std::mem::take(&mut *lock)
    };

    let executor = agent_tool::AgentToolExecutor::new();
    let emit = |event: &str, data: serde_json::Value| {
        let _ = app_handle.emit(event, data);
    };

    agent.send(input, content_parts, &executor, &state.http_client, &emit, &mut confirm_senders).await;

    // Clean up cancel token now that send is done
    {
        let mut cancel_lock = state.agent_cancel.lock().map_err(|e| e.to_string())?;
        *cancel_lock = None;
    }

    {
        let mut lock = state.pending_confirms.lock().map_err(|e| e.to_string())?;
        *lock = confirm_senders;
    }

    {
        let msgs = agent.messages.clone();
        let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as i64;
        let active = state.active_chat_id.lock().map_err(|e| e.to_string())?;
        if let Some(ref id) = *active {
            let chat_store = state.chat_store.lock().map_err(|e| e.to_string())?;
            if let Some(ref store) = *chat_store {
                if let Some(mut record) = store.get(id) {
                    record.messages = msgs;
                    record.updated_at = ts;
                    store.save(&record);
                }
            }
            drop(chat_store);
        }
        drop(active);
        let app = state.app_handle.lock().map_err(|e| e.to_string())?;
        if let Some(ref handle) = *app {
            let _ = handle.emit("vibe:chats:updated", ());
        }
    }

    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    *agent_lock = Some(agent);
    drop(agent_lock);

    let _ = app_handle.emit("vibe:agent:send-complete", ());

    Ok(())
}

#[tauri::command]
pub async fn agent_stop(state: State<'_, AppState>) -> Result<(), String> {
    // Try the agent first (it's in state when not currently sending)
    if let Ok(agent_lock) = state.agent.lock() {
        if let Some(ref agent) = *agent_lock {
            agent.stop();
            return Ok(());
        }
    }
    // Agent was taken out by agent_send — use the cancel token instead
    if let Ok(cancel_lock) = state.agent_cancel.lock() {
        if let Some(ref cancel) = *cancel_lock {
            cancel.store(true, Ordering::Relaxed);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_reset(state: State<'_, AppState>) -> Result<(), String> {
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

    let title = Agent::summarize_with(cfg, messages, &state.http_client).await;

    Ok(title)
}

#[tauri::command]
pub async fn agent_confirm(state: State<'_, AppState>, id: String, decision: String) -> Result<(), String> {
    let mut confirm_senders = state.pending_confirms.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = confirm_senders.remove(&id) {
        let _ = sender.send(decision);
    }
    Ok(())
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
    agent.instant_revert(index)
}

#[tauri::command]
pub async fn agent_revert_undo(state: State<'_, AppState>) -> Result<(), String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_mut().ok_or_else(|| "No agent".to_string())?;
    agent.undo_revert()
}

#[tauri::command]
pub async fn agent_set_cwd(state: State<'_, AppState>, cwd: String) -> Result<(), String> {
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
    if let Ok(mut config) = state.config.lock() {
        if let Some(ref mut c) = *config {
            c.api_key = api_key.clone();
            c.base_url = base_url.clone();
            c.model = model.clone();
            c.provider_id = provider_id.clone();
        }
    }

    // Обновляем URL для connection warmer
    {
        let mut url = state.provider_url.lock().await;
        *url = base_url.clone();
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
