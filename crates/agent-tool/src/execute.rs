use std::sync::atomic::AtomicBool;

use crate::{agent_tool, bash, edit, list_dir, read, search, write};
use crate::executor::AgentToolExecutor;

pub async fn execute_tool(
    name: &str,
    args: &serde_json::Value,
    cwd: &str,
    cancel: &AtomicBool,
    emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    executor: &AgentToolExecutor,
) -> Result<String, String> {
    match name {
        "read_file" => read::tool_read_file(cwd, args).await,
        "write_file" => write::tool_write_file(cwd, args).await,
        "edit_file" => edit::tool_edit_file(cwd, args).await,
        "list_dir" => list_dir::tool_list_dir(cwd, args).await,
        "bash" => bash::tool_bash(cwd, args, cancel).await,
        "search_codebase" => search::tool_search_codebase(cwd, args).await,
        "agent" => agent_tool::execute(cwd, args, cancel, emit, executor.get_llm_config()).await,
        _ => Err(format!("Unknown tool: {name}")),
    }
}
