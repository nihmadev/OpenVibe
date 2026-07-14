use mcp::{McpConfig, McpServerStatus, McpStatus};
use tauri::State;

#[tauri::command]
pub async fn mcp_get_servers(state: State<'_, crate::AppState>) -> Result<Vec<McpServerStatus>, String> {
    Ok(state.mcp_manager.get_servers().await)
}

#[tauri::command]
pub async fn mcp_start_server(state: State<'_, crate::AppState>, name: String) -> Result<(), String> {
    state.mcp_manager.start_server(&name).await
}

#[tauri::command]
pub async fn mcp_stop_server(state: State<'_, crate::AppState>, name: String) -> Result<(), String> {
    state.mcp_manager.stop_server(&name).await
}

#[tauri::command]
pub async fn mcp_restart_server(state: State<'_, crate::AppState>, name: String) -> Result<(), String> {
    state.mcp_manager.restart_server(&name).await
}

#[tauri::command]
pub async fn mcp_get_status(state: State<'_, crate::AppState>, name: String) -> Result<McpStatus, String> {
    state.mcp_manager.get_status(&name).await
}

#[tauri::command]
pub async fn mcp_get_config(state: State<'_, crate::AppState>) -> Result<McpConfig, String> {
    state.mcp_manager.get_config()
}

#[tauri::command]
pub async fn mcp_save_config(state: State<'_, crate::AppState>, config: McpConfig) -> Result<(), String> {
    state.mcp_manager.save_config(config).await
}

#[tauri::command]
pub async fn mcp_list_tools(state: State<'_, crate::AppState>, server_name: String) -> Result<Vec<String>, String> {
    state.mcp_manager.list_tools(&server_name).await
}
