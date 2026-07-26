use std::collections::HashSet;

use crate::chat::ChatMessage;
use crate::token::estimate_tokens;

pub fn supports_vision(model: &str) -> bool {
    let m = model.to_lowercase();
    m.contains("vision")
        || m.contains("-vl")
        || m.contains("_vl")
        || m.contains("vl-")
        || m.contains("multimodal")
        || m.contains("gpt-4o")
        || m.contains("gpt-4-turbo")
        || m.contains("o1")
        || m.contains("o3")
        || m.contains("claude-3")
        || m.contains("gemini")
        || m.contains("pixtral")
        || m.contains("llava")
}

pub fn flatten_for_text_only(messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
    messages
        .into_iter()
        .map(|mut m| {
            if let Some(ref content) = m.content {
                if let Some(parts) = content.as_array() {
                    let text: Vec<String> = parts
                        .iter()
                        .filter_map(|p| {
                            let t = p.get("type").and_then(|v| v.as_str())?;
                            match t {
                                "text" => p
                                    .get("text")
                                    .and_then(|v| v.as_str())
                                    .map(|s| s.to_string()),
                                "image_url" => Some("[image attached]".to_string()),
                                _ => None,
                            }
                        })
                        .collect();
                    m.content = Some(serde_json::Value::String(text.join("\n")));
                }
            }
            m
        })
        .collect()
}

/// Trim conversation history down to `keep` most recent messages while
/// preserving the task anchors: the system prompt AND the first user message
/// (the original task statement). Dropping the original request is the main
/// cause of goal drift and hallucinated context, so it must always survive.
pub fn trim_messages(messages: Vec<ChatMessage>, keep: usize) -> Vec<ChatMessage> {
    let total = messages.len();
    if total <= keep + 1 {
        return messages;
    }
    let system = messages.first().filter(|m| m.role == "system").cloned();
    let first_user = messages.iter().find(|m| m.role == "user").cloned();
    let tail_start = total.saturating_sub(keep);
    let first_user_in_tail = messages
        .iter()
        .position(|m| m.role == "user")
        .is_some_and(|idx| idx >= tail_start);

    let tail: Vec<ChatMessage> = messages.into_iter().skip(tail_start).collect();

    let valid_ids: HashSet<String> = tail
        .iter()
        .filter(|m| m.role == "assistant")
        .filter_map(|m| m.tool_calls.as_ref())
        .flat_map(|calls| calls.iter().map(|c| c.id.clone()))
        .collect();

    let mut result: Vec<ChatMessage> = Vec::with_capacity(tail.len() + 3);
    if let Some(s) = system {
        result.push(s);
    }
    if !first_user_in_tail {
        if let Some(first) = first_user {
            result.push(first);
        }
    }
    result.push(ChatMessage {
        role: "user".to_string(),
        content: Some(serde_json::Value::String(
            "[earlier conversation trimmed to fit context limit — the message above is the \
             original task; earlier tool results were dropped, re-read files if facts are needed]"
                .to_string(),
        )),
        name: None,
        tool_call_id: None,
        tool_calls: None,
        reasoning_content: None,
        reasoning_name: None,
        usage: None,
    });

    for msg in tail {
        if msg.role == "tool" {
            if let Some(ref id) = msg.tool_call_id {
                if !valid_ids.contains(id) {
                    continue;
                }
            }
        }
        result.push(msg);
    }
    result
}

/// Trim history only when the estimated token footprint exceeds `max_tokens`.
/// Repeatedly halves the kept tail until the budget is met (or a minimal tail
/// remains). Unlike a message-count heuristic this respects actual content
/// size: one large `read_file` result can outweigh dozens of small messages.
pub fn trim_messages_to_budget(messages: Vec<ChatMessage>, max_tokens: usize) -> Vec<ChatMessage> {
    if estimate_tokens(&messages) <= max_tokens {
        return messages;
    }

    let mut keep = messages.len().saturating_sub(2);
    while keep > 4 {
        let trimmed = trim_messages(messages.clone(), keep);
        if estimate_tokens(&trimmed) <= max_tokens {
            return trimmed;
        }
        keep /= 2;
    }
    trim_messages(messages, 4)
}

pub fn messages_to_api_json(messages: Vec<ChatMessage>) -> Vec<serde_json::Value> {
    messages_to_api_json_with_cache(messages, false)
}

/// Serialize the chat history to OpenAI-compatible message JSON.
///
/// When `use_prompt_cache` is true (Anthropic only — other providers reject
/// or ignore unknown fields), a `cache_control: {type: "ephemeral"}` marker
/// is attached to the system message (or the first user message when no
/// system message exists) so Anthropic caches the prompt prefix. Cache
/// invalidation is implicit: `update_system_prompt()` changes the system
/// content, which changes the cache key server-side — no purge needed.
pub fn messages_to_api_json_with_cache(
    messages: Vec<ChatMessage>,
    use_prompt_cache: bool,
) -> Vec<serde_json::Value> {
    let cache_target = if use_prompt_cache {
        find_cache_target(&messages)
    } else {
        None
    };

    messages
        .into_iter()
        .enumerate()
        .map(|(idx, m)| {
            let mut obj = serde_json::Map::new();
            obj.insert(
                "role".to_string(),
                serde_json::Value::String(m.role.clone()),
            );

            let content_val = m.content.clone();

            // Native reasoning round-trip. Providers such as DeepSeek require
            // the assistant's `reasoning_content` to be passed back VERBATIM
            // as a top-level field on turns that performed tool calls
            // (otherwise the API returns 400). Never synthesize placeholder
            // reasoning ("Executing tool call.") and never re-encode native
            // reasoning as <thought> text blocks — that corrupts the
            // provider-side reasoning state and pollutes the history.
            if m.role == "assistant" {
                if let Some(ref reasoning) = m.reasoning_content {
                    if !reasoning.trim().is_empty() {
                        obj.insert(
                            "reasoning_content".to_string(),
                            serde_json::Value::String(reasoning.clone()),
                        );
                    }
                }
            }

            if let Some(content) = content_val {
                let content = if cache_target == Some(idx) {
                    with_cache_control(content)
                } else {
                    content
                };
                obj.insert("content".to_string(), content);
            }
            if let Some(name) = m.name {
                obj.insert("name".to_string(), serde_json::Value::String(name));
            }
            if let Some(tool_call_id) = m.tool_call_id {
                obj.insert(
                    "tool_call_id".to_string(),
                    serde_json::Value::String(tool_call_id),
                );
            }
            if let Some(tool_calls) = m.tool_calls {
                obj.insert(
                    "tool_calls".to_string(),
                    serde_json::to_value(tool_calls).unwrap(),
                );
            }
            serde_json::Value::Object(obj)
        })
        .collect()
}

/// Index of the message that should carry the cache breakpoint: the system
/// message when present, otherwise the first user message.
fn find_cache_target(messages: &[ChatMessage]) -> Option<usize> {
    messages
        .iter()
        .position(|m| m.role == "system")
        .or_else(|| messages.iter().position(|m| m.role == "user"))
}

/// Attach `cache_control: {type: "ephemeral"}` to message content.
///
/// Anthropic's OpenAI-compatible endpoint accepts `cache_control` only on
/// content blocks, so plain string content is promoted to a one-element
/// `[{type: "text", ...}]` array. For array content the marker goes on the
/// last block (Anthropic caches everything up to and including that block).
fn with_cache_control(content: serde_json::Value) -> serde_json::Value {
    let ephemeral = serde_json::json!({ "type": "ephemeral" });
    match content {
        serde_json::Value::String(text) => serde_json::json!([{
            "type": "text",
            "text": text,
            "cache_control": ephemeral,
        }]),
        serde_json::Value::Array(mut parts) => {
            if let Some(serde_json::Value::Object(last)) = parts.last_mut() {
                last.insert("cache_control".to_string(), ephemeral);
            }
            serde_json::Value::Array(parts)
        }
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chat::ChatMessage;

    #[test]
    fn test_messages_to_api_json_round_trips_native_reasoning() {
        let msg = ChatMessage {
            role: "assistant".to_string(),
            content: Some(serde_json::Value::String("Hello".to_string())),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: Some("Internal thinking".to_string()),
            reasoning_name: None,
            usage: None,
        };

        let json_list = messages_to_api_json(vec![msg]);
        assert_eq!(json_list.len(), 1);
        let obj = json_list[0].as_object().unwrap();
        // Native reasoning must be passed back verbatim as a top-level field
        // (required by DeepSeek thinking-mode tool flows), NOT re-encoded as
        // a <thought> text block.
        assert_eq!(
            obj.get("reasoning_content").and_then(|v| v.as_str()),
            Some("Internal thinking")
        );
        let content = obj.get("content").unwrap().as_str().unwrap();
        assert_eq!(content, "Hello");
        assert!(!content.contains("<thought"));
    }

    #[test]
    fn test_messages_to_api_json_no_placeholder_reasoning_for_tool_calls() {
        use crate::chat::{ToolCall, ToolCallFunction};
        let msg = ChatMessage {
            role: "assistant".to_string(),
            content: None,
            name: None,
            tool_call_id: None,
            tool_calls: Some(vec![ToolCall {
                id: "call_1".to_string(),
                type_: "function".to_string(),
                function: ToolCallFunction {
                    name: "read_file".to_string(),
                    arguments: "{}".to_string(),
                    extra_fields: serde_json::Map::new(),
                },
                extra_fields: serde_json::Map::new(),
            }]),
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        };

        let json_list = messages_to_api_json(vec![msg]);
        let obj = json_list[0].as_object().unwrap();
        // No fake "Executing tool call." reasoning must ever be synthesized.
        assert!(!obj.contains_key("reasoning_content"));
        let content_text = obj.get("content").and_then(|v| v.as_str()).unwrap_or("");
        assert!(!content_text.contains("Executing tool call."));
        assert!(!content_text.contains("<thought"));
    }

    fn msg(role: &str, text: &str) -> ChatMessage {
        ChatMessage {
            role: role.to_string(),
            content: Some(serde_json::Value::String(text.to_string())),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }
    }

    fn text_of(m: &ChatMessage) -> &str {
        match m.content {
            Some(serde_json::Value::String(ref s)) => s,
            _ => "",
        }
    }

    #[test]
    fn test_trim_messages_preserves_first_user_message() {
        let mut msgs = vec![msg("system", "sys"), msg("user", "ORIGINAL TASK")];
        for i in 0..30 {
            msgs.push(msg("assistant", &format!("step {i}")));
        }
        let trimmed = trim_messages(msgs, 5);

        assert_eq!(trimmed[0].role, "system");
        assert_eq!(trimmed[1].role, "user");
        assert_eq!(text_of(&trimmed[1]), "ORIGINAL TASK");
        assert!(text_of(&trimmed[2]).contains("trimmed"));
        // Tail is preserved
        assert_eq!(text_of(trimmed.last().unwrap()), "step 29");
    }

    #[test]
    fn test_trim_messages_no_duplicate_first_user_when_in_tail() {
        let msgs = vec![
            msg("system", "sys"),
            msg("user", "TASK"),
            msg("assistant", "a1"),
        ];
        // keep=5 > total-1, so no trimming at all
        let untouched = trim_messages(msgs.clone(), 5);
        assert_eq!(untouched.len(), 3);

        // keep=2: tail contains the first user message already
        let trimmed = trim_messages(msgs, 2);
        let user_count = trimmed
            .iter()
            .filter(|m| m.role == "user" && text_of(m) == "TASK")
            .count();
        assert_eq!(user_count, 1);
    }

    #[test]
    fn test_trim_messages_drops_orphan_tool_results() {
        let mut msgs = vec![msg("system", "sys"), msg("user", "TASK")];
        for i in 0..20 {
            msgs.push(msg("assistant", &format!("step {i}")));
        }
        let mut orphan_tool = msg("tool", "orphan result");
        orphan_tool.tool_call_id = Some("dead-call".to_string());
        msgs.push(orphan_tool);
        msgs.push(msg("assistant", "final"));

        let trimmed = trim_messages(msgs, 5);
        assert!(!trimmed.iter().any(|m| m.role == "tool"));
    }

    #[test]
    fn test_trim_messages_to_budget_noop_when_under_budget() {
        let msgs = vec![msg("system", "sys"), msg("user", "hello")];
        let out = trim_messages_to_budget(msgs.clone(), 1_000_000);
        assert_eq!(out.len(), msgs.len());
    }

    #[test]
    fn test_trim_messages_to_budget_trims_large_history() {
        let mut msgs = vec![msg("system", "sys"), msg("user", "ORIGINAL TASK")];
        for i in 0..50 {
            msgs.push(msg("assistant", &format!("{i} {}", "word ".repeat(500))));
        }
        let out = trim_messages_to_budget(msgs, 5000);
        assert!(crate::token::estimate_tokens(&out) < 20000);
        // Anchors survive
        assert_eq!(out[0].role, "system");
        assert_eq!(text_of(&out[1]), "ORIGINAL TASK");
    }

    #[test]
    fn test_cache_control_added_to_system_message_when_enabled() {
        let msgs = vec![msg("system", "You are helpful."), msg("user", "hi")];
        let json_list = messages_to_api_json_with_cache(msgs, true);

        // System content promoted to a content-block array with cache_control.
        let system_content = json_list[0].get("content").unwrap();
        let blocks = system_content.as_array().expect("array content");
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].get("type").unwrap(), "text");
        assert_eq!(blocks[0].get("text").unwrap(), "You are helpful.");
        assert_eq!(
            blocks[0]
                .get("cache_control")
                .and_then(|c| c.get("type"))
                .and_then(|t| t.as_str()),
            Some("ephemeral")
        );

        // User message stays a plain string, no cache_control.
        assert_eq!(
            json_list[1].get("content").and_then(|v| v.as_str()),
            Some("hi")
        );
    }

    #[test]
    fn test_cache_control_falls_back_to_first_user_without_system() {
        let msgs = vec![msg("user", "task"), msg("assistant", "ok")];
        let json_list = messages_to_api_json_with_cache(msgs, true);

        let blocks = json_list[0].get("content").unwrap().as_array().unwrap();
        assert!(blocks[0].get("cache_control").is_some());
        // Assistant untouched.
        assert_eq!(
            json_list[1].get("content").and_then(|v| v.as_str()),
            Some("ok")
        );
    }

    #[test]
    fn test_cache_control_absent_when_disabled() {
        let msgs = vec![msg("system", "sys"), msg("user", "hi")];
        let json_list = messages_to_api_json_with_cache(msgs.clone(), false);
        // Content stays a plain string for non-Anthropic providers.
        assert_eq!(
            json_list[0].get("content").and_then(|v| v.as_str()),
            Some("sys")
        );
        // Default entry point never adds cache_control.
        let default_list = messages_to_api_json(msgs);
        assert_eq!(
            default_list[0].get("content").and_then(|v| v.as_str()),
            Some("sys")
        );
    }

    #[test]
    fn test_cache_control_on_last_block_of_array_content() {
        let msgs = vec![ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::json!([
                {"type": "text", "text": "part one"},
                {"type": "text", "text": "part two"},
            ])),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }];
        let json_list = messages_to_api_json_with_cache(msgs, true);
        let blocks = json_list[0].get("content").unwrap().as_array().unwrap();
        assert_eq!(blocks.len(), 2);
        assert!(blocks[0].get("cache_control").is_none());
        assert_eq!(
            blocks[1]
                .get("cache_control")
                .and_then(|c| c.get("type"))
                .and_then(|t| t.as_str()),
            Some("ephemeral")
        );
    }

    #[test]
    fn test_messages_to_api_json_does_not_duplicate_thinking_block() {
        let msg = ChatMessage {
            role: "assistant".to_string(),
            content: Some(serde_json::Value::String(
                "<thinking>\nalready thought\n</thinking>\nAnswer".to_string(),
            )),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: Some("already thought".to_string()),
            reasoning_name: None,
            usage: None,
        };

        let json_list = messages_to_api_json(vec![msg]);
        let content = json_list[0]
            .get("content")
            .and_then(|v| v.as_str())
            .unwrap();
        // Content stays untouched; reasoning travels only via the native field.
        assert!(!content.contains("<thought "));
        assert!(!content.contains("<thought>"));
        assert_eq!(
            json_list[0]
                .get("reasoning_content")
                .and_then(|v| v.as_str()),
            Some("already thought")
        );
    }
}
