use crate::agent::Agent;
use crate::chat::ChatMessage;
use crate::request::stream_chat;
use crate::token::compute_context_usage_with_last;

/// Marker prefix identifying an injected compaction summary message. The UI
/// uses it to render the entry as a system notice instead of a user bubble.
pub const COMPACT_MARKER: &str = "[context-compacted]";

/// Compact when estimated context usage reaches this percentage.
const COMPACT_THRESHOLD_PERCENT: usize = 80;

/// How many most recent messages survive compaction verbatim.
const KEEP_RECENT: usize = 8;

/// Minimum number of messages in the compactable middle range for the
/// operation to be worth an extra LLM call.
const MIN_COMPACTABLE: usize = 4;

/// Per-message caps when building the transcript handed to the summarizer.
const MAX_TOOL_RESULT_CHARS: usize = 700;
const MAX_MESSAGE_CHARS: usize = 2000;
/// Upper bound for the whole transcript (keeps the summarization request cheap).
const MAX_TRANSCRIPT_CHARS: usize = 120_000;

fn truncate_chars(text: &str, max: usize) -> String {
    if text.chars().count() <= max {
        return text.to_string();
    }
    let truncated: String = text.chars().take(max).collect();
    format!("{truncated}… [truncated]")
}

fn content_to_text(content: &Option<serde_json::Value>) -> String {
    match content {
        Some(serde_json::Value::String(s)) => s.clone(),
        Some(serde_json::Value::Array(parts)) => parts
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
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

fn build_transcript(messages: &[ChatMessage]) -> String {
    let mut lines: Vec<String> = Vec::with_capacity(messages.len());
    for msg in messages {
        match msg.role.as_str() {
            "user" => {
                let text = content_to_text(&msg.content);
                if !text.trim().is_empty() {
                    lines.push(format!(
                        "USER:\n{}",
                        truncate_chars(&text, MAX_MESSAGE_CHARS)
                    ));
                }
            }
            "assistant" => {
                let text = content_to_text(&msg.content);
                if !text.trim().is_empty() {
                    lines.push(format!(
                        "ASSISTANT:\n{}",
                        truncate_chars(&text, MAX_MESSAGE_CHARS)
                    ));
                }
                if let Some(ref calls) = msg.tool_calls {
                    for call in calls {
                        lines.push(format!(
                            "ASSISTANT TOOL CALL: {}({})",
                            call.function.name,
                            truncate_chars(&call.function.arguments, MAX_TOOL_RESULT_CHARS)
                        ));
                    }
                }
            }
            "tool" => {
                let text = content_to_text(&msg.content);
                lines.push(format!(
                    "TOOL RESULT:\n{}",
                    truncate_chars(&text, MAX_TOOL_RESULT_CHARS)
                ));
            }
            _ => {}
        }
    }
    let transcript = lines.join("\n\n");
    if transcript.chars().count() > MAX_TRANSCRIPT_CHARS {
        let skip = transcript.chars().count() - MAX_TRANSCRIPT_CHARS;
        let tail: String = transcript.chars().skip(skip).collect();
        format!("[transcript head truncated]\n{tail}")
    } else {
        transcript
    }
}

fn summarizer_system_prompt() -> String {
    [
        "You are a conversation compaction engine inside an autonomous coding agent.",
        "You will receive a transcript of the middle part of an agent session (the original \
         task and the most recent messages are preserved elsewhere and are NOT included).",
        "Produce a dense, factual handoff summary so the agent can continue seamlessly. \
         Use EXACTLY these four markdown sections in this order:",
        "",
        "## MAIN GOAL",
        "Restate the user's overarching objective in 1-3 sentences.",
        "",
        "## COMPLETED",
        "Bullet list of work already done: files read/modified (exact paths), commands run, \
         decisions made, findings confirmed.",
        "",
        "## NEXT GOALS",
        "Bullet list of the remaining steps, in priority order.",
        "",
        "## CRITICAL CONTEXT",
        "Bullet list of facts required to continue: exact file paths, function/type names, \
         line references, error messages, constraints, user preferences, gotchas discovered.",
        "",
        "RULES:",
        "- Base every statement STRICTLY on the transcript. Never invent files, APIs, or facts.",
        "- Prefer exact identifiers (paths, symbols, versions) over prose.",
        "- No preamble, no closing remarks — output the four sections only.",
        "- Keep it under 600 words.",
    ]
    .join("\n")
}

impl Agent {
    /// Проверяет заполнение контекстного окна и при достижении порога (>= 80%)
    /// выполняет компакцию истории через LLM: середина диалога заменяется
    /// структурированным резюме (главная цель / завершено / следующие цели /
    /// критический контекст). Системный промпт, первое сообщение пользователя
    /// и последние сообщения сохраняются дословно.
    pub async fn maybe_compact_context(
        &mut self,
        client: &reqwest::Client,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) {
        let model = self.config().model.clone();
        let usage =
            compute_context_usage_with_last(&self.messages, &model, self.last_prompt_tokens);
        if usage.percent < COMPACT_THRESHOLD_PERCENT {
            return;
        }

        let total = self.messages.len();
        let first_user_idx = match self.messages.iter().position(|m| m.role == "user") {
            Some(idx) => idx,
            None => return,
        };

        let tail_start = total.saturating_sub(KEEP_RECENT);
        // Compactable middle: everything after the first user message and
        // before the preserved tail.
        let range_start = first_user_idx + 1;
        if tail_start <= range_start || tail_start - range_start < MIN_COMPACTABLE {
            return;
        }

        let transcript = build_transcript(&self.messages[range_start..tail_start]);
        if transcript.trim().is_empty() {
            return;
        }

        emit(
            "vibe:agent:context-compaction-start",
            serde_json::json!({
                "usedTokens": usage.used_tokens,
                "maxTokens": usage.max_tokens,
                "percent": usage.percent,
            }),
        );

        let summary = self.summarize_transcript(&transcript, client).await;

        let summary = match summary {
            Some(s) if !s.trim().is_empty() => s,
            _ => {
                // LLM compaction failed: fall back to a lossy trim so the
                // request still fits. trim_messages preserves the first user
                // message (task anchor).
                tracing::warn!("LLM context compaction failed; falling back to trim");
                let trimmed = crate::transform::trim_messages(self.messages.clone(), KEEP_RECENT);
                self.apply_new_messages(trimmed);
                emit(
                    "vibe:agent:context-compaction-end",
                    serde_json::json!({"ok": false}),
                );
                return;
            }
        };

        // Assemble the compacted history:
        // [system?] + [first user] + [summary marker message] + tail
        let mut new_msgs: Vec<ChatMessage> = Vec::with_capacity(KEEP_RECENT + 3);
        let mut index_map: Vec<usize> = vec![0; total];

        if self.messages.first().map(|m| m.role.as_str()) == Some("system") {
            new_msgs.push(self.messages[0].clone());
        }
        index_map[0] = 0;

        index_map[first_user_idx] = new_msgs.len();
        new_msgs.push(self.messages[first_user_idx].clone());

        let summary_idx = new_msgs.len();
        new_msgs.push(ChatMessage {
            role: "user".to_string(),
            content: Some(serde_json::Value::String(format!(
                "{COMPACT_MARKER} Earlier conversation was compacted to fit the context \
                 window. Structured summary of the removed part:\n\n{summary}"
            ))),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        });
        for slot in index_map.iter_mut().take(tail_start).skip(range_start) {
            *slot = summary_idx;
        }

        // Preserve the tail, dropping tool results whose assistant tool_calls
        // did not survive (they can't exist without their pair).
        let valid_ids: std::collections::HashSet<String> = self.messages[tail_start..]
            .iter()
            .filter(|m| m.role == "assistant")
            .filter_map(|m| m.tool_calls.as_ref())
            .flat_map(|calls| calls.iter().map(|c| c.id.clone()))
            .collect();

        for (offset, msg) in self.messages[tail_start..].iter().enumerate() {
            let old_idx = tail_start + offset;
            if msg.role == "tool" {
                if let Some(ref id) = msg.tool_call_id {
                    if !valid_ids.contains(id) {
                        index_map[old_idx] = summary_idx;
                        continue;
                    }
                }
            }
            index_map[old_idx] = new_msgs.len();
            new_msgs.push(msg.clone());
        }

        // Remap file snapshots so rollback keeps working after indices shift.
        for entry in &mut self.file_snapshots {
            if entry.message_index < index_map.len() {
                entry.message_index = index_map[entry.message_index];
            } else {
                entry.message_index = new_msgs.len().saturating_sub(1);
            }
        }

        self.messages = new_msgs;
        // The previous provider-reported prompt size no longer reflects the
        // compacted history; drop it so usage estimates reset. Cache metrics
        // are stale too: the rewritten prefix maps to a new Anthropic cache key.
        self.last_prompt_tokens = None;
        self.last_cache_creation_tokens = None;
        self.last_cache_read_tokens = None;

        let new_usage = compute_context_usage_with_last(&self.messages, &model, None);
        emit(
            "vibe:agent:context-compaction-end",
            serde_json::json!({
                "ok": true,
                "usedTokens": new_usage.used_tokens,
                "maxTokens": new_usage.max_tokens,
                "percent": new_usage.percent,
            }),
        );
    }

    /// Fallback path shared with the failed-LLM branch: replace messages and
    /// clamp snapshot indices conservatively.
    fn apply_new_messages(&mut self, new_msgs: Vec<ChatMessage>) {
        for entry in &mut self.file_snapshots {
            if entry.message_index >= new_msgs.len() {
                entry.message_index = new_msgs.len().saturating_sub(1);
            }
        }
        self.messages = new_msgs;
        self.last_prompt_tokens = None;
        self.last_cache_creation_tokens = None;
        self.last_cache_read_tokens = None;
    }

    async fn summarize_transcript(
        &self,
        transcript: &str,
        client: &reqwest::Client,
    ) -> Option<String> {
        let llm_config = self.config().llm_config();
        let prompt = vec![
            ChatMessage {
                role: "system".to_string(),
                content: Some(serde_json::Value::String(summarizer_system_prompt())),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
                usage: None,
            },
            ChatMessage {
                role: "user".to_string(),
                content: Some(serde_json::Value::String(format!(
                    "Transcript to compact:\n\n{transcript}"
                ))),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
                usage: None,
            },
        ];

        let result = stream_chat(
            &llm_config,
            prompt,
            vec![],
            &self.cancel,
            client,
            &|_| {},
            &|_| {},
            &|_| {},
            &|| {},
            &|_, _| {},
        )
        .await;

        match result {
            Ok(turn) => {
                let content = turn.content.trim().to_string();
                if content.is_empty() {
                    None
                } else {
                    Some(content)
                }
            }
            Err(e) => {
                tracing::warn!("Context compaction LLM call failed: {e}");
                None
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chat::{ToolCall, ToolCallFunction};

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

    #[test]
    fn test_truncate_chars_short() {
        assert_eq!(truncate_chars("hello", 10), "hello");
    }

    #[test]
    fn test_truncate_chars_long() {
        let out = truncate_chars(&"a".repeat(20), 5);
        assert!(out.starts_with("aaaaa"));
        assert!(out.ends_with("[truncated]"));
    }

    #[test]
    fn test_build_transcript_includes_roles_and_tools() {
        let mut assistant = msg("assistant", "I will read the file");
        assistant.tool_calls = Some(vec![ToolCall {
            id: "t1".to_string(),
            type_: "function".to_string(),
            function: ToolCallFunction {
                name: "read_file".to_string(),
                arguments: "{\"path\":\"src/main.rs\"}".to_string(),
                extra_fields: serde_json::Map::new(),
            },
            extra_fields: serde_json::Map::new(),
        }]);
        let mut tool = msg("tool", "fn main() {}");
        tool.tool_call_id = Some("t1".to_string());

        let transcript = build_transcript(&[msg("user", "explain main"), assistant, tool]);
        assert!(transcript.contains("USER:\nexplain main"));
        assert!(transcript.contains("ASSISTANT TOOL CALL: read_file"));
        assert!(transcript.contains("TOOL RESULT:\nfn main() {}"));
    }

    #[test]
    fn test_content_to_text_multimodal() {
        let content = Some(serde_json::json!([
            {"type": "text", "text": "look"},
            {"type": "image_url", "image_url": {"url": "data:..."}}
        ]));
        let text = content_to_text(&content);
        assert!(text.contains("look"));
        assert!(text.contains("[image attached]"));
    }

    #[test]
    fn test_summarizer_prompt_sections() {
        let p = summarizer_system_prompt();
        assert!(p.contains("## MAIN GOAL"));
        assert!(p.contains("## COMPLETED"));
        assert!(p.contains("## NEXT GOALS"));
        assert!(p.contains("## CRITICAL CONTEXT"));
    }
}
