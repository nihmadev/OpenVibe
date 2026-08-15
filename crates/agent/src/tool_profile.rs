//! Language-agnostic tool profile selection.
//!
//! A new session starts with the full tool surface, so the model is never
//! expected to infer capabilities from user wording. Once the model has used
//! a capability, later turns retain that capability plus the core workspace
//! tools. It can explicitly unlock another group with `tool_request`.

use std::collections::HashSet;

use crate::chat::ChatMessage;
use crate::definition::ToolDefinition;

const CORE_TOOLS: &[&str] = &[
    "read_file",
    "write_file",
    "edit_file",
    "list_dir",
    "run",
    "search_codebase",
    "todo",
    "tool_request",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolProfileKind {
    Full,
    Focused,
}

fn tool_calls(messages: &[ChatMessage]) -> impl Iterator<Item = &crate::chat::ToolCall> {
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

/// Select the smallest safe tool surface based solely on prior tool activity,
/// never on the user's natural-language text. If MCP tools are present, keep
/// the full surface because their arbitrary schemas cannot be grouped safely.
pub fn select_tool_profile(
    all_tools: &[ToolDefinition],
    messages: &[ChatMessage],
) -> (ToolProfileKind, Vec<ToolDefinition>) {
    let called: HashSet<&str> = tool_calls(messages)
        .map(|call| call.function.name.as_str())
        .collect();
    let has_mcp = all_tools
        .iter()
        .any(|tool| tool.function.name.starts_with("mcp__"));

    if called.is_empty() || has_mcp {
        return (ToolProfileKind::Full, all_tools.to_vec());
    }

    let requested = requested_capabilities(messages);
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
        })
        .cloned()
        .collect();

    (ToolProfileKind::Focused, selected)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chat::{ToolCall, ToolCallFunction};

    fn tool(name: &str) -> ToolDefinition {
        ToolDefinition {
            type_: "function".to_string(),
            function: crate::definition::ToolDefFunction {
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
    fn new_session_keeps_every_tool_for_a_language_independent_first_turn() {
        let all = vec![tool("read_file"), tool("git_blame"), tool("web_search")];
        let (kind, selected) = select_tool_profile(&all, &[]);
        assert_eq!(kind, ToolProfileKind::Full);
        assert_eq!(selected.len(), all.len());
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
}
