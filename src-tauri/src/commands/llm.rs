use crate::AppState;
use agent::chat::ChatMessage;
use agent::config::LlmConfig;
use agent::definition::ToolDefinition;
use agent::request::stream_chat;
use agent::token::compute_context_usage_with_last;
use agent::token::ContextUsage;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[tauri::command]
pub fn estimate_context_tokens(state: State<AppState>) -> Result<ContextUsage, String> {
    let agent_lock = state.agent.lock().map_err(|e| e.to_string())?;
    let agent = agent_lock.as_ref().ok_or_else(|| "No agent".to_string())?;
    let messages = agent.get_messages();
    let model = agent.config().model.clone();
    let usage = compute_context_usage_with_last(messages, &model, agent.last_prompt_tokens);
    Ok(usage)
}

#[tauri::command]
pub async fn llm_stream(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    config: LlmConfig,
    messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut map = state.llm_cancels.lock().map_err(|e| e.to_string())?;
        map.insert(session_id.clone(), cancel.clone());
    }

    let session_id_clone = session_id.clone();
    let app_for_emit = app_handle.clone();

    let result = stream_chat(
        &config,
        messages,
        tools,
        &cancel,
        &state.http_client,
        &|chunk| {
            let _ = app_for_emit
                .emit("vibe:llm:delta", serde_json::json!({ "sessionId": &session_id_clone, "content": chunk }));
        },
        &|chunk| {
            let _ = app_for_emit
                .emit("vibe:llm:reasoning", serde_json::json!({ "sessionId": &session_id_clone, "content": chunk }));
        },
        &|name| {
            let _ = app_for_emit
                .emit("vibe:llm:reasoning_start", serde_json::json!({ "sessionId": &session_id_clone, "name": name }));
        },
        &|| {
            let _ = app_for_emit.emit("vibe:llm:reasoning_end", serde_json::json!({ "sessionId": &session_id_clone }));
        },
        &|_, _| {},
    )
    .await;

    {
        let mut map = state.llm_cancels.lock().map_err(|e| e.to_string())?;
        map.remove(&session_id);
    }

    match result {
        Ok(turn) => {
            let _ = app_handle.emit(
                "vibe:llm:done",
                serde_json::json!({
                    "sessionId": session_id,
                    "content": turn.content,
                    "toolCalls": turn.tool_calls,
                }),
            );
            Ok(())
        }
        Err(e) => {
            let _ = app_handle.emit("vibe:llm:error", serde_json::json!({ "sessionId": session_id, "error": e }));
            Err(e)
        }
    }
}

#[tauri::command]
pub fn llm_abort(state: State<AppState>, session_id: String) -> Result<(), String> {
    let map = state.llm_cancels.lock().map_err(|e| e.to_string())?;
    if let Some(cancel) = map.get(&session_id) {
        cancel.store(true, Ordering::Relaxed);
    }
    Ok(())
}
