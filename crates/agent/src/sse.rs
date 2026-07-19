use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use crate::chat::{AssistantTurn, ToolCall, ToolCallFunction};

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
    on_reasoning_name: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
    on_tool_args: &(dyn Fn(&str, &str) + Send + Sync),
) -> Result<AssistantTurn, String> {
    let mut content = String::new();
    let mut reasoning_content: Option<String> = None;
    let mut reasoning_name: Option<String> = None;
    let mut has_seen_reasoning = false;
    let mut in_thought_tag = false;
    let mut thought_buf = String::new();
    let mut tool_acc: HashMap<usize, ToolCallAcc> = HashMap::new();
    let mut buffer = String::with_capacity(4096);
    let mut buf_idx = 0usize;
    // `Response::chunk()` is allowed to split a multibyte UTF-8 character.
    // Keep an incomplete suffix until the next network chunk instead of
    // dropping the whole chunk.
    let mut utf8_tail = Vec::new();

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        let chunk = tokio::time::timeout(Duration::from_millis(100), res.chunk()).await;
        match chunk {
            Ok(Ok(Some(bytes))) => {
                append_utf8_chunk(&bytes, &mut utf8_tail, &mut buffer);

                while let Some(pos) = buffer[buf_idx..].find('\n') {
                    let abs_pos = buf_idx + pos;
                    let line = &buffer[buf_idx..abs_pos];
                    buf_idx = abs_pos + 1;
                    process_sse_line(
                        line,
                        &mut content,
                        &mut reasoning_content,
                        &mut reasoning_name,
                        &mut has_seen_reasoning,
                        &mut in_thought_tag,
                        &mut thought_buf,
                        &mut tool_acc,
                        on_delta,
                        on_reasoning,
                        on_reasoning_name,
                        on_reasoning_end,
                        on_tool_args,
                    );
                }
            }
            Ok(Ok(None)) => {
                if !utf8_tail.is_empty() {
                    buffer.push_str(&String::from_utf8_lossy(&utf8_tail));
                    utf8_tail.clear();
                }
                let remaining = buffer[buf_idx..].trim();
                if !remaining.is_empty() {
                    process_sse_line(
                        remaining,
                        &mut content,
                        &mut reasoning_content,
                        &mut reasoning_name,
                        &mut has_seen_reasoning,
                        &mut in_thought_tag,
                        &mut thought_buf,
                        &mut tool_acc,
                        on_delta,
                        on_reasoning,
                        on_reasoning_name,
                        on_reasoning_end,
                        on_tool_args,
                    );
                }
                break;
            }
            Ok(Err(e)) => return Err(e.to_string()),
            Err(_) => {} // timeout – loop back to check cancel
        }
    }

    if !thought_buf.is_empty() {
        if in_thought_tag || has_seen_reasoning {
            reasoning_content
                .get_or_insert_with(String::new)
                .push_str(&thought_buf);
            on_reasoning(&thought_buf);
        } else {
            content.push_str(&thought_buf);
            on_delta(&thought_buf);
        }
        thought_buf.clear();
    }

    if has_seen_reasoning || in_thought_tag {
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
        reasoning_name,
    })
}

/// Append a network chunk without losing text when UTF-8 is split at a chunk
/// boundary. Invalid bytes inside a chunk are preserved as replacement
/// characters rather than causing the entire chunk to disappear.
fn append_utf8_chunk(bytes: &[u8], tail: &mut Vec<u8>, output: &mut String) {
    tail.extend_from_slice(bytes);
    match std::str::from_utf8(tail) {
        Ok(text) => {
            output.push_str(text);
            tail.clear();
        }
        Err(error) if error.error_len().is_none() => {
            let valid_up_to = error.valid_up_to();
            output.push_str(
                std::str::from_utf8(&tail[..valid_up_to])
                    .expect("valid_up_to must end on a UTF-8 boundary"),
            );
            let incomplete = tail[valid_up_to..].to_vec();
            tail.clear();
            tail.extend_from_slice(&incomplete);
        }
        Err(_) => {
            output.push_str(&String::from_utf8_lossy(tail));
            tail.clear();
        }
    }
}

fn extract_thought_name(tag: &str) -> Option<String> {
    let lower = tag.to_lowercase();
    let idx = lower.find("name")?;
    let after_name = &tag[idx + 4..];
    let eq_idx = after_name.find('=')?;
    let after_eq = after_name[eq_idx + 1..].trim_start();
    if let Some(first_char) = after_eq.chars().next() {
        if first_char == '"' || first_char == '\'' {
            let quote = first_char;
            let rest = &after_eq[1..];
            if let Some(end_idx) = rest.find(quote) {
                let name = rest[..end_idx].trim();
                if !name.is_empty() {
                    return Some(name.to_string());
                }
            }
        } else {
            let end_idx = after_eq
                .find(|c: char| c.is_whitespace() || c == '>')
                .unwrap_or(after_eq.len());
            let name = after_eq[..end_idx].trim();
            if !name.is_empty() && name != ">" {
                return Some(name.to_string());
            }
        }
    }
    None
}

fn process_text_chunk(
    text: &str,
    is_api_reasoning: bool,
    content: &mut String,
    reasoning_content: &mut Option<String>,
    reasoning_name: &mut Option<String>,
    has_seen_reasoning: &mut bool,
    in_thought_tag: &mut bool,
    thought_buf: &mut String,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_name: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
) {
    if !is_api_reasoning && *has_seen_reasoning && !*in_thought_tag {
        *has_seen_reasoning = false;
        on_reasoning_end();
    }

    if is_api_reasoning {
        *has_seen_reasoning = true;
    }

    let mut s = format!("{}{}", thought_buf, text);
    thought_buf.clear();

    while !s.is_empty() {
        if !*in_thought_tag && !is_api_reasoning {
            let lower = s.to_lowercase();
            if let Some(pos) = lower.find("<thought") {
                if pos > 0 {
                    let before = &s[..pos];
                    content.push_str(before);
                    on_delta(before);
                }
                let remainder = &s[pos..];
                if let Some(gt_idx) = remainder.find('>') {
                    let tag = &remainder[..=gt_idx];
                    if let Some(name) = extract_thought_name(tag) {
                        *reasoning_name = Some(name.clone());
                        on_reasoning_name(&name);
                    }
                    *in_thought_tag = true;
                    *has_seen_reasoning = true;
                    s = remainder[gt_idx + 1..].to_string();
                } else {
                    thought_buf.push_str(remainder);
                    break;
                }
            } else {
                if let Some(lt_idx) = s.rfind('<') {
                    let tail_lower = s[lt_idx..].to_lowercase();
                    if "<thought".starts_with(&tail_lower)
                        || (tail_lower.starts_with("<thought") && !tail_lower.contains('>'))
                    {
                        let before = &s[..lt_idx];
                        if !before.is_empty() {
                            content.push_str(before);
                            on_delta(before);
                        }
                        thought_buf.push_str(&s[lt_idx..]);
                        break;
                    }
                }
                content.push_str(&s);
                on_delta(&s);
                break;
            }
        } else {
            let lower = s.to_lowercase();
            if !*in_thought_tag && is_api_reasoning {
                if let Some(pos) = lower.find("<thought") {
                    let remainder = &s[pos..];
                    if let Some(gt_idx) = remainder.find('>') {
                        let tag = &remainder[..=gt_idx];
                        if let Some(name) = extract_thought_name(tag) {
                            *reasoning_name = Some(name.clone());
                            on_reasoning_name(&name);
                        }
                        *in_thought_tag = true;
                        let before = &s[..pos];
                        if !before.is_empty() {
                            reasoning_content
                                .get_or_insert_with(String::new)
                                .push_str(before);
                            on_reasoning(before);
                        }
                        s = remainder[gt_idx + 1..].to_string();
                        continue;
                    }
                }
            }

            let lower = s.to_lowercase();
            if let Some(end_pos) = lower.find("</thought>") {
                let before = &s[..end_pos];
                if !before.is_empty() {
                    reasoning_content
                        .get_or_insert_with(String::new)
                        .push_str(before);
                    on_reasoning(before);
                }
                *in_thought_tag = false;
                *has_seen_reasoning = false;
                on_reasoning_end();
                s = s[end_pos + 10..].to_string();
            } else {
                if let Some(lt_idx) = s.rfind('<') {
                    let tail_lower = s[lt_idx..].to_lowercase();
                    if "</thought>".starts_with(&tail_lower) {
                        let before = &s[..lt_idx];
                        if !before.is_empty() {
                            reasoning_content
                                .get_or_insert_with(String::new)
                                .push_str(before);
                            on_reasoning(before);
                        }
                        thought_buf.push_str(&s[lt_idx..]);
                        break;
                    }
                }
                reasoning_content
                    .get_or_insert_with(String::new)
                    .push_str(&s);
                on_reasoning(&s);
                break;
            }
        }
    }
}

#[allow(clippy::too_many_arguments)]
fn process_sse_line(
    line: &str,
    content: &mut String,
    reasoning_content: &mut Option<String>,
    reasoning_name: &mut Option<String>,
    has_seen_reasoning: &mut bool,
    in_thought_tag: &mut bool,
    thought_buf: &mut String,
    tool_acc: &mut HashMap<usize, ToolCallAcc>,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_name: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
    on_tool_args: &(dyn Fn(&str, &str) + Send + Sync),
) {
    let trimmed = line.trim();
    if trimmed.is_empty() || trimmed == "data: [DONE]" {
        return;
    }

    let payload = if let Some(stripped) = trimmed.strip_prefix("data:") {
        stripped.trim()
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
            process_text_chunk(
                rc,
                true,
                content,
                reasoning_content,
                reasoning_name,
                has_seen_reasoning,
                in_thought_tag,
                thought_buf,
                on_delta,
                on_reasoning,
                on_reasoning_name,
                on_reasoning_end,
            );
        }
    }

    if let Some(dc) = delta.get("content").and_then(|v| v.as_str()) {
        if !dc.is_empty() {
            process_text_chunk(
                dc,
                false,
                content,
                reasoning_content,
                reasoning_name,
                has_seen_reasoning,
                in_thought_tag,
                thought_buf,
                on_delta,
                on_reasoning,
                on_reasoning_name,
                on_reasoning_end,
            );
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

#[cfg(test)]
mod tests {
    use super::append_utf8_chunk;

    #[test]
    fn preserves_utf8_when_chunks_split_inside_cyrillic_text() {
        let source = "параллельный запуск";
        let bytes = source.as_bytes();

        for split in 1..bytes.len() {
            let mut tail = Vec::new();
            let mut output = String::new();
            append_utf8_chunk(&bytes[..split], &mut tail, &mut output);
            append_utf8_chunk(&bytes[split..], &mut tail, &mut output);
            assert!(tail.is_empty());
            assert_eq!(output, source, "split at byte {split}");
        }
    }
}
