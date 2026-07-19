use crate::AppState;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

#[derive(Serialize)]
pub struct InitResult {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub config: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientConfig {
    pub model: String,
    pub base_url: String,
    pub cwd: String,
    pub auto_approve: bool,
    pub api_key: String,
    pub api_url: Option<String>,
    pub provider_id: Option<String>,
}

#[tauri::command]
pub fn init_app(state: State<AppState>) -> Result<InitResult, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let config_val = config.as_ref().map(|c| {
        serde_json::json!({
            "model": c.model,
            "baseUrl": c.base_url,
            "cwd": c.cwd,
            "autoApprove": c.auto_approve,
            "apiKey": if c.api_key.is_empty() { "" } else { "***" },
            "apiUrl": c.api_url,
            "providerId": c.provider_id,
        })
    });
    Ok(InitResult { ok: true, config: config_val, error: None })
}

#[tauri::command]
pub fn read_config(state: State<AppState>) -> Result<Option<ClientConfig>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.as_ref().map(|c| ClientConfig {
        model: c.model.clone(),
        base_url: c.base_url.clone(),
        cwd: c.cwd.clone(),
        auto_approve: c.auto_approve,
        api_key: c.api_key.clone(),
        api_url: c.api_url.clone(),
        provider_id: c.provider_id.clone(),
    }))
}

#[tauri::command]
pub fn window_minimize(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn window_maximize(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        // Fullscreen is independent from maximized on Wayland. Calling
        // maximize() while fullscreen is active is commonly ignored by the
        // compositor, so leave fullscreen first and restore a usable window.
        if window.is_fullscreen().unwrap_or(false) {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
            window.set_size(tauri::LogicalSize::new(1300_u32, 820_u32)).map_err(|e| e.to_string())?;
            let _ = window.center();
            return Ok(());
        }
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn window_close(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Request a native resize for the onboarding flow. On Wayland this is a
/// compositor request, so the resulting size may be clamped or ignored.
#[tauri::command]
pub fn window_set_size(app_handle: tauri::AppHandle, width: u32, height: u32) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_fullscreen().unwrap_or(false) {
            window.set_fullscreen(false).map_err(|e| e.to_string())?;
        }
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        }
        window.set_size(tauri::LogicalSize::new(width, height)).map_err(|e| e.to_string())?;
        // Best-effort centering; Wayland compositors may choose the placement.
        let _ = window.center();
    }
    Ok(())
}

#[tauri::command]
pub fn window_set_fullscreen(app_handle: tauri::AppHandle, fullscreen: bool) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_fullscreen(fullscreen).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn is_maximized(app_handle: tauri::AppHandle) -> Result<bool, String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        return window.is_maximized().map_err(|e| e.to_string());
    }
    Ok(false)
}

#[tauri::command]
pub fn get_cwd(state: State<AppState>) -> Result<String, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config.as_ref().map(|c| c.cwd.clone()).unwrap_or_default())
}

#[tauri::command]
pub fn set_model(state: State<AppState>, model: String) -> Result<(), String> {
    {
        let mut config = state.config.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut c) = *config {
            c.model = model.clone();
            // Persist model change to provider
            if let Some(ref pid) = c.provider_id {
                let store = state.projects.lock().map_err(|e| e.to_string())?;
                let _ = store.update_provider_model(pid, &model);
            }
        }
    }
    // Also update agent's internal config so the next request uses the new model
    if let Ok(mut agent_lock) = state.agent.lock() {
        if let Some(ref mut agent) = *agent_lock {
            agent.config_mut().model = model;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_provider(
    state: State<AppState>,
    api_key: String,
    base_url: String,
    model: String,
    provider_id: Option<String>,
) -> Result<(), String> {
    let mut config = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(ref mut c) = *config {
        c.api_key = api_key;
        c.base_url = base_url;
        c.model = model;
        if provider_id.is_some() {
            c.provider_id = provider_id;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn window_zoom(app_handle: tauri::AppHandle, factor: f64) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.set_zoom(factor).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn state_get(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.get_state(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn state_set(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.set_state(&key, &value).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_system_user() -> Result<String, String> {
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_else(|_| "Developer".to_string());
    Ok(user)
}
