use std::sync::atomic::AtomicBool;

use crate::executor::AgentToolExecutor;
use crate::{agent_tool, bash, edit, git, list_dir, read, search, todo, write};

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
