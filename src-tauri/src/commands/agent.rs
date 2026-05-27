use tauri::{AppHandle, Emitter, State};

use crate::agent::Agent;
use crate::{config, llm, AppState};

#[tauri::command]
pub async fn agent_new(state: State<'_, AppState>, cwd: String) -> Result<(), String> {
    let cfg = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock
            .as_ref()
            .cloned()
            .unwrap_or_else(|| config::Config {
                api_key: String::new(),
                base_url: "https://api.openai.com/v1".to_string(),
                model: "gpt-4o-mini".to_string(),
                cwd: cwd.clone(),
                auto_approve: false,
                provider_id: None,
                api_url: Some("https://openvibe-api-production.up.railway.app".to_string()),
            })
    };

    let agent = Agent::new(cfg);
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
    let mut agent = {
        let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
        agent_lock.take()
    }
    .ok_or_else(|| "No agent created yet. Call agent_new first.".to_string())?;

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    // Take the confirms map out so we don't hold the MutexGuard across await
    let mut confirm_senders = {
        let mut lock = state.pending_confirms.lock().map_err(|e| e.to_string())?;
        std::mem::take(&mut *lock)
    };

    agent
        .send(input, content_parts, &app_handle, &mut confirm_senders, &client)
        .await;

    // Put back the confirms map (may have been modified with new confirm channels)
    {
        let mut lock = state.pending_confirms.lock().map_err(|e| e.to_string())?;
        *lock = confirm_senders;
    }

    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    *agent_lock = Some(agent);
    drop(agent_lock);

    let _ = app_handle.emit("vibe:agent:send-complete", ());

    Ok(())
}

#[tauri::command]
pub async fn agent_stop(state: State<'_, AppState>) -> Result<(), String> {
    let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref agent) = *agent_lock {
        agent.stop();
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
        (agent.get_messages().to_vec(), agent.get_config().clone())
    };

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let title = Agent::summarize_with(cfg, messages, &client).await;

    Ok(title)
}

#[tauri::command]
pub async fn agent_confirm(
    state: State<'_, AppState>,
    id: String,
    decision: String,
) -> Result<(), String> {
    let mut confirm_senders = state.pending_confirms.lock().map_err(|e| e.to_string())?;
    if let Some(sender) = confirm_senders.remove(&id) {
        let _ = sender.send(decision);
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_set_messages(
    state: State<'_, AppState>,
    messages: Vec<llm::ChatMessage>,
) -> Result<(), String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        agent.set_messages(messages);
    }
    Ok(())
}

#[tauri::command]
pub async fn agent_get_messages(
    state: State<'_, AppState>,
) -> Result<Vec<llm::ChatMessage>, String> {
    let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock
        .as_ref()
        .ok_or_else(|| "No agent".to_string())?;
    Ok(agent.get_messages().to_vec())
}

#[tauri::command]
pub async fn agent_revert_to(state: State<'_, AppState>, index: usize) -> Result<(), String> {
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        agent.revert_to(index);
    }
    Ok(())
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
    // Update both AppState config and agent's internal config
    if let Ok(mut config) = state.config.lock() {
        if let Some(ref mut c) = *config {
            c.api_key = api_key.clone();
            c.base_url = base_url.clone();
            c.model = model.clone();
            c.provider_id = provider_id.clone();
        }
    }
    let mut agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut agent) = *agent_lock {
        let cfg = agent.get_config_mut();
        cfg.api_key = api_key;
        cfg.base_url = base_url;
        cfg.model = model;
        cfg.provider_id = provider_id;
    }
    Ok(())
}
