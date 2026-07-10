use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::chat::{ToolCall, ToolCallFunction, AssistantTurn};

struct ToolCallAcc {
    id: String,
    name: String,
    arguments: String,
}

pub async fn parse_sse_stream(
    mut res: reqwest::Response,
    cancel: &AtomicBool,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
    on_tool_args: &(dyn Fn(&str, &str) + Send + Sync),
) -> Result<AssistantTurn, String> {
    let mut content = String::new();
    let mut reasoning_content: Option<String> = None;
    let mut has_seen_reasoning = false;
    let mut tool_acc: HashMap<usize, ToolCallAcc> = HashMap::new();
    let mut buffer = String::new();

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        let chunk = res.chunk().await.map_err(|e| e.to_string())?;
        match chunk {
            Some(bytes) => {
                let chunk_str = String::from_utf8_lossy(&bytes);
                buffer.push_str(&chunk_str);

                while let Some(pos) = buffer.find('\n') {
                    let line = buffer[..pos].to_string();
                    buffer = buffer[pos + 1..].to_string();
                    process_sse_line(
                        &line,
                        &mut content,
                        &mut reasoning_content,
                        &mut has_seen_reasoning,
                        &mut tool_acc,
                        on_delta,
                        on_reasoning,
                        on_reasoning_end,
                        on_tool_args,
                    );
                }
            }
            None => {
                let remaining = buffer.trim();
                if !remaining.is_empty() {
                    process_sse_line(
                        remaining,
                        &mut content,
                        &mut reasoning_content,
                        &mut has_seen_reasoning,
                        &mut tool_acc,
                        on_delta,
                        on_reasoning,
                        on_reasoning_end,
                        on_tool_args,
                    );
                }
                break;
            }
        }
    }

    if has_seen_reasoning {
        on_reasoning_end();
    }

    let mut tool_calls: Vec<(usize, ToolCallAcc)> = tool_acc.into_iter().collect();
    tool_calls.sort_by_key(|(idx, _)| *idx);
    let tool_calls: Vec<ToolCall> = tool_calls
        .into_iter()
        .map(|(_, v)| ToolCall {
            id: v.id,
            type_: "function".to_string(),
            function: ToolCallFunction {
                name: v.name,
                arguments: v.arguments,
            },
        })
        .collect();

    Ok(AssistantTurn {
        content,
        tool_calls,
        reasoning_content,
    })
}

fn process_sse_line(
    line: &str,
    content: &mut String,
    reasoning_content: &mut Option<String>,
    has_seen_reasoning: &mut bool,
    tool_acc: &mut HashMap<usize, ToolCallAcc>,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
    on_tool_args: &(dyn Fn(&str, &str) + Send + Sync),
) {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed == "data: [DONE]" {
        return;
    }

    let payload = if trimmed.starts_with("data:") {
        trimmed[5..].trim()
    } else if trimmed.starts_with('{') && trimmed.ends_with('}') {
        trimmed
    } else {
        return;
    };

    if payload.is_empty() || payload == "[DONE]" {
        return;
    }

    let event: serde_json::Value = match serde_json::from_str(payload) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("Failed to parse SSE payload: {e}");
            return;
        }
    };

    let delta = match event
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|c| c.first())
        .and_then(|c| c.get("delta"))
    {
        Some(d) => d,
        None => return,
    };

    if let Some(rc) = delta.get("reasoning_content").and_then(|v| v.as_str()) {
        if !rc.is_empty() {
            *has_seen_reasoning = true;
            reasoning_content.get_or_insert_with(String::new).push_str(rc);
            on_reasoning(rc);
        }
    }

    if let Some(dc) = delta.get("content").and_then(|v| v.as_str()) {
        if !dc.is_empty() {
            if *has_seen_reasoning {
                *has_seen_reasoning = false;
                on_reasoning_end();
            }
            content.push_str(dc);
            on_delta(dc);
        }
    }

    if let Some(tcs) = delta.get("tool_calls").and_then(|v| v.as_array()) {
        for tc in tcs {
            let idx = tc.get("index").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
            let entry = tool_acc.entry(idx).or_insert_with(|| ToolCallAcc {
                id: format!(
                    "call_{}_{idx}",
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_millis()
                ),
                name: String::new(),
                arguments: String::new(),
            });
            if let Some(id) = tc.get("id").and_then(|v| v.as_str()) {
                entry.id = id.to_string();
            }
            if let Some(func) = tc.get("function") {
                if let Some(name) = func.get("name").and_then(|v| v.as_str()) {
                    entry.name = name.to_string();
                }
                if let Some(args) = func.get("arguments").and_then(|v| v.as_str()) {
                    entry.arguments.push_str(args);
                    on_tool_args(&entry.id, &entry.arguments);
                }
            }
        }
    }

    if let Some(fc) = delta.get("function_call") {
        let entry = tool_acc.entry(0).or_insert_with(|| ToolCallAcc {
            id: format!(
                "call_{}_f",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis()
            ),
            name: String::new(),
            arguments: String::new(),
        });
        if let Some(name) = fc.get("name").and_then(|v| v.as_str()) {
            entry.name = name.to_string();
        }
        if let Some(args) = fc.get("arguments").and_then(|v| v.as_str()) {
            entry.arguments.push_str(args);
            on_tool_args(&entry.id, &entry.arguments);
        }
    }
}
