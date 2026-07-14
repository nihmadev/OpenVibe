use agent::definition::ToolDefinition;
use tauri::State;

#[tauri::command]
pub fn tools_definitions() -> Vec<ToolDefinition> {
    agent_tool::build_tool_definitions()
}

#[tauri::command]
pub async fn tools_execute(
    state: State<'_, crate::AppState>,
    name: String,
    args: serde_json::Value,
) -> Result<String, String> {
    let cwd = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        config_lock.as_ref().map(|c| c.cwd.clone()).unwrap_or_default()
    };

    let cancel = std::sync::atomic::AtomicBool::new(false);
    let executor = agent_tool::AgentToolExecutor::with_mcp(state.mcp_manager.clone());

    let emit = |_: &str, _: serde_json::Value| {};
    agent_tool::execute_tool(&name, &args, &cwd, &cancel, &emit, &executor).await
}
