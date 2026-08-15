use std::sync::atomic::AtomicBool;

use crate::executor::AgentToolExecutor;
use crate::{agent_tool, edit, git, list_dir, read, run, search, todo, web, write};

pub async fn execute_tool(
    name: &str,
    args: &serde_json::Value,
    cwd: &str,
    cancel: &AtomicBool,
    emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    executor: &AgentToolExecutor,
) -> Result<String, String> {
    match name {
        "tool_request" => tool_request(args),
        "read_file" => read::tool_read_file(cwd, args).await,
        "write_file" => write::tool_write_file(cwd, args).await,
        "edit_file" => edit::tool_edit_file(cwd, args).await,
        "list_dir" => list_dir::tool_list_dir(cwd, args).await,
        "run" => run::tool_run(cwd, args, cancel).await,
        "search_codebase" => search::tool_search_codebase(cwd, args).await,
        "web_search" => web::web_search(args, executor.get_llm_config().as_ref()).await,
        "fetch_url" => web::fetch_url(args).await,
        "todo" => todo::tool_todo(args).await,
        "agent" => agent_tool::execute(cwd, args, cancel, emit, executor.get_llm_config()).await,
        "git_status" => git::status(cwd, args).await,
        "git_branches" => git::branches(cwd, args).await,
        "git_log" => git::log(cwd, args).await,
        "git_diff" => git::diff(cwd, args).await,
        "git_show" => git::show(cwd, args).await,
        "git_blame" => git::blame(cwd, args).await,
        "git_merge_base" => git::merge_base(cwd, args).await,
        "git_tree" => git::tree(cwd, args).await,
        "git_grep" => git::grep(cwd, args).await,
        "git_check_ignore" => git::check_ignore(cwd, args).await,
        "git_stash_list" => git::stash_list(cwd, args).await,
        "git_reflog" => git::reflog(cwd, args).await,
        "git_remotes" => git::remotes(cwd, args).await,
        "git_refs" => git::refs(cwd, args).await,
        "git_worktrees" => git::worktrees(cwd, args).await,
        "git_submodules" => git::submodules(cwd, args).await,
        _ => Err(format!("Unknown tool: {name}")),
    }
}

fn tool_request(args: &serde_json::Value) -> Result<String, String> {
    let capabilities = args
        .get("capabilities")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| "tool_request requires a capabilities array".to_string())?;
    let mut accepted = Vec::new();
    for capability in capabilities {
        let capability = capability
            .as_str()
            .ok_or_else(|| "tool_request capabilities must be strings".to_string())?;
        if !matches!(capability, "git" | "web" | "research") {
            return Err(format!("Unknown capability group: {capability}"));
        }
        accepted.push(capability);
    }
    Ok(format!(
        "Capability group(s) {} unlocked for the next turn. Now call the concrete tool you need.",
        accepted.join(", ")
    ))
}

#[cfg(test)]
mod tests {
    use super::tool_request;

    #[test]
    fn pseudo_model_capability_request_is_accepted() {
        let result = tool_request(&serde_json::json!({"capabilities": ["web", "git"]}));
        assert!(result.unwrap().contains("web, git unlocked"));
    }

    #[test]
    fn capability_request_rejects_unknown_groups() {
        let result = tool_request(&serde_json::json!({"capabilities": ["shell_magic"]}));
        assert_eq!(result.unwrap_err(), "Unknown capability group: shell_magic");
    }
}
