use crate::tools;
use tauri::State;

#[tauri::command]
pub fn tools_definitions() -> Vec<tools::ToolDefinition> {
    tools::build_tool_definitions()
}

#[tauri::command]
pub async fn tools_execute(
    state: State<'_, crate::AppState>,
    name: String,
    args: serde_json::Value,
) -> Result<String, String> {
    let cwd = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock
            .as_ref()
            .map(|c| c.cwd.clone())
            .unwrap_or_default()
    };

    tools::execute_tool(&name, &args, &cwd, None).await
}
