use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use crate::AppState;
use crate::llm;

#[tauri::command]
pub async fn llm_stream(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    session_id: String,
    config: llm::LlmConfig,
    messages: Vec<llm::ChatMessage>,
    tools: Vec<llm::ToolDefinition>,
) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut map = state.llm_cancels.lock().map_err(|e| e.to_string())?;
        map.insert(session_id.clone(), cancel.clone());
    }

    let client = reqwest::Client::builder()
        .build()
        .map_err(|e| e.to_string())?;

    let session_id_clone = session_id.clone();
    let app_for_emit = app_handle.clone();

    let result = llm::stream_chat(
        &config,
        messages,
        tools,
        &cancel,
        &client,
        &|chunk| {
            let _ = app_for_emit.emit(
                "vibe:llm:delta",
                serde_json::json!({ "sessionId": &session_id_clone, "content": chunk }),
            );
        },
        &|chunk| {
            let _ = app_for_emit.emit(
                "vibe:llm:reasoning",
                serde_json::json!({ "sessionId": &session_id_clone, "content": chunk }),
            );
        },
        &|| {
            let _ = app_for_emit.emit(
                "vibe:llm:reasoning_end",
                serde_json::json!({ "sessionId": &session_id_clone }),
            );
        },
    )
    .await;

    // Clean up cancel token
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
            let _ = app_handle.emit(
                "vibe:llm:error",
                serde_json::json!({ "sessionId": session_id, "error": e }),
            );
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
