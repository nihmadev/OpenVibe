use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

use crate::AppState;

fn emit_from(app: &AppHandle) -> impl Fn(&str, Value) + Send + Sync + '_ {
    move |event, payload| {
        let _ = app.emit(event, payload);
    }
}

#[tauri::command]
pub async fn browser_start(app: AppHandle, state: State<'_, AppState>) -> Result<Value, String> {
    let event_app = app.clone();
    state.browser_manager.set_ui_event_sink(Arc::new(move |event, payload| {
        let _ = event_app.emit(event, payload);
    }));
    let result = state.browser_manager.open_ui(&emit_from(&app)).await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_navigate_ui(app: AppHandle, state: State<'_, AppState>, url: String) -> Result<Value, String> {
    let result = state.browser_manager.navigate_ui(&url, &emit_from(&app)).await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_history_ui(app: AppHandle, state: State<'_, AppState>, direction: i32) -> Result<Value, String> {
    let result = state.browser_manager.history_ui(direction.signum(), &emit_from(&app)).await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_reload_ui(app: AppHandle, state: State<'_, AppState>) -> Result<Value, String> {
    let result = state.browser_manager.reload_ui(&emit_from(&app)).await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_snapshot_ui(app: AppHandle, state: State<'_, AppState>) -> Result<Value, String> {
    let result = state.browser_manager.snapshot(&emit_from(&app)).await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_resize_ui(state: State<'_, AppState>, width: u32, height: u32) -> Result<(), String> {
    state.browser_manager.resize_ui(width, height).await
}

#[tauri::command]
pub async fn browser_set_ui_stream_active(state: State<'_, AppState>, active: bool) -> Result<(), String> {
    state.browser_manager.set_ui_stream_active(active).await
}

#[tauri::command]
pub async fn browser_tabs_ui(
    app: AppHandle,
    state: State<'_, AppState>,
    action: String,
    target_id: Option<String>,
    url: Option<String>,
) -> Result<Value, String> {
    let result = state.browser_manager.tabs_ui(&action, target_id.as_deref(), url.as_deref(), &emit_from(&app)).await?;
    serde_json::to_value(result).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn browser_set_manual_control(
    app: AppHandle,
    state: State<'_, AppState>,
    manual: bool,
) -> Result<(), String> {
    state.browser_manager.set_manual_control(manual, &emit_from(&app)).await
}

#[tauri::command]
pub async fn browser_manual_pointer(
    app: AppHandle,
    state: State<'_, AppState>,
    kind: String,
    x: f64,
    y: f64,
    delta_x: Option<f64>,
    delta_y: Option<f64>,
) -> Result<(), String> {
    state
        .browser_manager
        .manual_pointer(&kind, x, y, delta_x.unwrap_or(0.0), delta_y.unwrap_or(0.0), &emit_from(&app))
        .await
}

#[tauri::command]
pub async fn browser_manual_key(
    app: AppHandle,
    state: State<'_, AppState>,
    key: String,
    text: Option<String>,
) -> Result<(), String> {
    state.browser_manager.manual_key(&key, text.as_deref(), &emit_from(&app)).await
}

#[tauri::command]
pub async fn browser_close(app: AppHandle, state: State<'_, AppState>) -> Result<Value, String> {
    let result = state.browser_manager.close(&emit_from(&app)).await?;
    Ok(serde_json::to_value(result).unwrap_or_else(|_| json!({"closed":true})))
}
