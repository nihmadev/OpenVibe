//! Language-agnostic tool profile selection.
//!
//! A new session starts with the full built-in surface except deferred
//! capabilities (browser and MCP servers). Once explicitly requested or used,
//! a capability remains available for the rest of the task.

use std::collections::HashSet;

use agent_api::{ChatMessage, ToolCall, ToolDefinition};

const CORE_TOOLS: &[&str] = &[
    "read_file",
    "write_file",
    "edit_file",
    "list_dir",
    "run",
    "search_codebase",
    "todo",
    "tool_request",
    "list_skills",
    "read_skill",
    "read_skill_resource",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolProfileKind {
    Full,
    Focused,
}

fn tool_calls(messages: &[ChatMessage]) -> impl Iterator<Item = &ToolCall> {
    messages
        .iter()
        .filter_map(|message| message.tool_calls.as_ref())
        .flat_map(|calls| calls.iter())
}

fn requested_capabilities(messages: &[ChatMessage]) -> HashSet<String> {
    tool_calls(messages)
        .filter(|call| call.function.name == "tool_request")
        .filter_map(|call| serde_json::from_str::<serde_json::Value>(&call.function.arguments).ok())
        .filter_map(|args| {
            args.get("capabilities")
                .and_then(serde_json::Value::as_array)
                .cloned()
        })
        .flatten()
        .filter_map(|value| value.as_str().map(str::to_owned))
        .collect()
}

fn mcp_server(name: &str) -> Option<&str> {
    name.strip_prefix("mcp__")?
        .split_once("__")
        .map(|(server, _)| server)
}

/// Select the smallest safe tool surface based solely on prior tool activity,
/// never on the user's natural-language text. Browser and each MCP server are
/// deferred groups, so merely connecting a server does not expose its schemas.
pub fn select_tool_profile(
    all_tools: &[ToolDefinition],
    messages: &[ChatMessage],
) -> (ToolProfileKind, Vec<ToolDefinition>) {
    let called: HashSet<&str> = tool_calls(messages)
        .map(|call| call.function.name.as_str())
        .collect();
    let requested = requested_capabilities(messages);
    let browser_active =
        called.iter().any(|name| name.starts_with("browser_")) || requested.contains("browser");
    let active_mcp_servers: HashSet<String> = called
        .iter()
        .filter_map(|name| mcp_server(name).map(str::to_string))
        .chain(
            requested
                .iter()
                .filter_map(|capability| capability.strip_prefix("mcp:").map(str::to_string)),
        )
        .collect();

    if called.is_empty() {
        let selected = all_tools
            .iter()
            .filter(|tool| {
                let name = tool.function.name.as_str();
                !name.starts_with("browser_") && !name.starts_with("mcp__")
            })
            .cloned()
            .collect();
        return (ToolProfileKind::Full, selected);
    }

    let use_git = called.iter().any(|name| name.starts_with("git_")) || requested.contains("git");
    let use_web =
        called.contains("web_search") || called.contains("fetch_url") || requested.contains("web");
    let use_research = called.contains("agent") || requested.contains("research");

    let selected = all_tools
        .iter()
        .filter(|tool| {
            let name = tool.function.name.as_str();
            CORE_TOOLS.contains(&name)
                || (use_git && name.starts_with("git_"))
                || (use_web && matches!(name, "web_search" | "fetch_url"))
                || (use_research && name == "agent")
                || (browser_active && name.starts_with("browser_"))
                || mcp_server(name).is_some_and(|server| active_mcp_servers.contains(server))
        })
        .cloned()
        .collect();

    (ToolProfileKind::Focused, selected)
}

#[cfg(test)]
mod tests {
    use super::*;
    use agent_api::{ToolCall, ToolCallFunction};

    fn tool(name: &str) -> ToolDefinition {
        ToolDefinition {
            type_: "function".to_string(),
            function: agent_api::ToolDefFunction {
                name: name.to_string(),
                description: String::new(),
                parameters: serde_json::json!({"type": "object"}),
            },
        }
    }

    fn assistant_call(name: &str, arguments: &str) -> ChatMessage {
        ChatMessage {
            role: "assistant".to_string(),
            content: None,
            name: None,
            tool_call_id: None,
            tool_calls: Some(vec![ToolCall {
                id: "call_1".to_string(),
                type_: "function".to_string(),
                function: ToolCallFunction {
                    name: name.to_string(),
                    arguments: arguments.to_string(),
                    extra_fields: Default::default(),
                },
                extra_fields: Default::default(),
            }]),
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }
    }

    fn names(tools: Vec<ToolDefinition>) -> HashSet<String> {
        tools.into_iter().map(|tool| tool.function.name).collect()
    }

    #[test]
    fn new_session_defers_browser_and_mcp_schemas() {
        let all = vec![
            tool("read_file"),
            tool("git_blame"),
            tool("web_search"),
            tool("browser_open"),
            tool("mcp__slack__send_message"),
        ];
        let (kind, selected) = select_tool_profile(&all, &[]);
        assert_eq!(kind, ToolProfileKind::Full);
        let selected = names(selected);
        assert!(selected.contains("read_file"));
        assert!(!selected.contains("browser_open"));
        assert!(!selected.contains("mcp__slack__send_message"));
    }

    #[test]
    fn pseudo_model_request_unlocks_a_new_group_without_keyword_matching() {
        let all = vec![
            tool("read_file"),
            tool("tool_request"),
            tool("git_blame"),
            tool("web_search"),
            tool("fetch_url"),
        ];
        let messages = vec![assistant_call(
            "tool_request",
            r#"{"capabilities":["web"]}"#,
        )];
        let (kind, selected) = select_tool_profile(&all, &messages);
        assert_eq!(kind, ToolProfileKind::Focused);
        let selected = names(selected);
        assert!(selected.contains("web_search"));
        assert!(selected.contains("fetch_url"));
        assert!(!selected.contains("git_blame"));
    }

    #[test]
    fn used_git_capability_is_preserved_on_following_turns() {
        let all = vec![
            tool("read_file"),
            tool("tool_request"),
            tool("git_diff"),
            tool("git_blame"),
        ];
        let messages = vec![assistant_call("git_diff", "{}")];
        let (_, selected) = select_tool_profile(&all, &messages);
        let selected = names(selected);
        assert!(selected.contains("git_diff"));
        assert!(selected.contains("git_blame"));
    }

    #[test]
    fn browser_capability_is_lazy_and_persists_after_use() {
        let all = vec![
            tool("read_file"),
            tool("tool_request"),
            tool("browser_open"),
            tool("browser_click"),
        ];
        let requested = vec![assistant_call(
            "tool_request",
            r#"{"capabilities":["browser"]}"#,
        )];
        let (_, selected) = select_tool_profile(&all, &requested);
        assert!(names(selected).contains("browser_click"));

        let used = vec![assistant_call("browser_open", "{}")];
        let (_, selected) = select_tool_profile(&all, &used);
        assert!(names(selected).contains("browser_open"));
    }

    #[test]
    fn mcp_tools_are_grouped_by_server() {
        let all = vec![
            tool("read_file"),
            tool("tool_request"),
            tool("mcp__slack__search"),
            tool("mcp__github__search"),
        ];
        let messages = vec![assistant_call(
            "tool_request",
            r#"{"capabilities":["mcp:slack"]}"#,
        )];
        let (_, selected) = select_tool_profile(&all, &messages);
        let selected = names(selected);
        assert!(selected.contains("mcp__slack__search"));
        assert!(!selected.contains("mcp__github__search"));
    }
}
