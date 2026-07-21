use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::chat::{AssistantTurn, TokenUsage, ToolCall, ToolCallFunction};

struct ToolCallAcc {
    id: String,
    name: String,
    arguments: String,
    extra_fields: serde_json::Map<String, serde_json::Value>,
    func_extra_fields: serde_json::Map<String, serde_json::Value>,
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
    let mut usage: Option<TokenUsage> = None;
    let mut buffer = String::with_capacity(4096);
    let mut utf8_tail = Vec::new();

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        match res.chunk().await {
            Ok(Some(bytes)) => {
                append_utf8_chunk(&bytes, &mut utf8_tail, &mut buffer);

                let mut scan_start = 0usize;
                while let Some(pos) = buffer[scan_start..].find('\n') {
                    let abs_pos = scan_start + pos;
                    let line = &buffer[scan_start..abs_pos];
                    process_sse_line(
                        line,
                        &mut content,
                        &mut reasoning_content,
                        &mut reasoning_name,
                        &mut has_seen_reasoning,
                        &mut in_thought_tag,
                        &mut thought_buf,
                        &mut tool_acc,
                        &mut usage,
                        on_delta,
                        on_reasoning,
                        on_reasoning_name,
                        on_reasoning_end,
                        on_tool_args,
                    );
                    scan_start = abs_pos + 1;
                }
                if scan_start > 0 {
                    buffer.drain(..scan_start);
                }
            }
            Ok(None) => {
                if !utf8_tail.is_empty() {
                    buffer.push_str(&String::from_utf8_lossy(&utf8_tail));
                    utf8_tail.clear();
                }
                let remaining = buffer.trim();
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
                        &mut usage,
                        on_delta,
                        on_reasoning,
                        on_reasoning_name,
                        on_reasoning_end,
                        on_tool_args,
                    );
                }
                buffer.clear();
                break;
            }
            Err(e) => return Err(e.to_string()),
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
                extra_fields: v.func_extra_fields,
            },
            extra_fields: v.extra_fields,
        })
        .collect();

    Ok(AssistantTurn {
        content,
        tool_calls,
        reasoning_content,
        reasoning_name,
        usage,
    })
}

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

#[inline]
fn find_ascii_ignore_case(haystack: &str, needle: &str) -> Option<usize> {
    if needle.is_empty() {
        return Some(0);
    }
    let needle_bytes = needle.as_bytes();
    let haystack_bytes = haystack.as_bytes();
    if needle_bytes.len() > haystack_bytes.len() {
        return None;
    }
    for i in 0..=haystack_bytes.len() - needle_bytes.len() {
        if haystack_bytes[i..i + needle_bytes.len()]
            .iter()
            .zip(needle_bytes.iter())
            .all(|(h, n)| h.eq_ignore_ascii_case(n))
        {
            return Some(i);
        }
    }
    None
}

fn find_thought_open_tag(s: &str) -> Option<(usize, usize)> {
    let pos_think = find_ascii_ignore_case(s, "<think");
    let pos_thought = find_ascii_ignore_case(s, "<thought");

    let pos = match (pos_think, pos_thought) {
        (Some(a), Some(b)) => std::cmp::min(a, b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => return None,
    };

    let remainder = &s[pos..];
    let gt_idx = remainder.find('>')?;
    Some((pos, gt_idx + 1))
}

fn find_thought_close_tag(s: &str) -> Option<(usize, usize)> {
    let pos_think = find_ascii_ignore_case(s, "</think");
    let pos_thought = find_ascii_ignore_case(s, "</thought");

    let pos = match (pos_think, pos_thought) {
        (Some(a), Some(b)) => std::cmp::min(a, b),
        (Some(a), None) => a,
        (None, Some(b)) => b,
        (None, None) => return None,
    };

    let remainder = &s[pos..];
    let gt_idx = remainder.find('>')?;
    Some((pos, gt_idx + 1))
}

#[inline]
fn is_partial_thought_open(tail: &str) -> bool {
    let tail_bytes = tail.as_bytes();
    let p1 = b"<think";
    let p2 = b"<thought";

    let match_p1 = if tail_bytes.len() <= p1.len() {
        tail_bytes
            .iter()
            .zip(p1.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
    } else {
        tail_bytes[..p1.len()]
            .iter()
            .zip(p1.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
            && !tail_bytes.contains(&b'>')
    };

    let match_p2 = if tail_bytes.len() <= p2.len() {
        tail_bytes
            .iter()
            .zip(p2.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
    } else {
        tail_bytes[..p2.len()]
            .iter()
            .zip(p2.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
            && !tail_bytes.contains(&b'>')
    };

    match_p1 || match_p2
}

#[inline]
fn is_partial_thought_close(tail: &str) -> bool {
    let tail_bytes = tail.as_bytes();
    let p1 = b"</think";
    let p2 = b"</thought";

    let match_p1 = if tail_bytes.len() <= p1.len() {
        tail_bytes
            .iter()
            .zip(p1.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
    } else {
        tail_bytes[..p1.len()]
            .iter()
            .zip(p1.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
            && !tail_bytes.contains(&b'>')
    };

    let match_p2 = if tail_bytes.len() <= p2.len() {
        tail_bytes
            .iter()
            .zip(p2.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
    } else {
        tail_bytes[..p2.len()]
            .iter()
            .zip(p2.iter())
            .all(|(b, p)| b.eq_ignore_ascii_case(p))
            && !tail_bytes.contains(&b'>')
    };

    match_p1 || match_p2
}

fn extract_thought_name(tag: &str) -> Option<String> {
    let idx = find_ascii_ignore_case(tag, "name")?;
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

    let owned_input;
    let mut s: &str = if !thought_buf.is_empty() {
        thought_buf.push_str(text);
        owned_input = std::mem::take(thought_buf);
        &owned_input
    } else {
        text
    };

    while !s.is_empty() {
        if !*in_thought_tag && !is_api_reasoning {
            // Only search for thought open tag if no main content has been emitted yet
            // and the tag appears at the start of text (or after whitespace only).
            let can_open_thought = content.trim().is_empty();
            let mut tag_opened = false;

            if can_open_thought {
                if let Some((pos, tag_len)) = find_thought_open_tag(s) {
                    if s[..pos].trim().is_empty() {
                        let tag = &s[pos..pos + tag_len];
                        if let Some(name) = extract_thought_name(tag) {
                            *reasoning_name = Some(name.clone());
                            on_reasoning_name(&name);
                        }
                        *in_thought_tag = true;
                        *has_seen_reasoning = true;
                        s = &s[pos + tag_len..];
                        tag_opened = true;
                    }
                } else if let Some(lt_idx) = s.rfind('<') {
                    if s[..lt_idx].trim().is_empty() {
                        let tail = &s[lt_idx..];
                        if is_partial_thought_open(tail) {
                            thought_buf.push_str(tail);
                            break;
                        }
                    }
                }
            }

            if !tag_opened {
                content.push_str(s);
                on_delta(s);
                break;
            }
        } else {
            if !*in_thought_tag && is_api_reasoning {
                if let Some((pos, tag_len)) = find_thought_open_tag(s) {
                    let tag = &s[pos..pos + tag_len];
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
                    s = &s[pos + tag_len..];
                    continue;
                }
            }

            if let Some((end_pos, tag_len)) = find_thought_close_tag(s) {
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
                s = &s[end_pos + tag_len..];
            } else {
                if let Some(lt_idx) = s.rfind('<') {
                    let tail = &s[lt_idx..];
                    if is_partial_thought_close(tail) {
                        let before = &s[..lt_idx];
                        if !before.is_empty() {
                            reasoning_content
                                .get_or_insert_with(String::new)
                                .push_str(before);
                            on_reasoning(before);
                        }
                        thought_buf.push_str(tail);
                        break;
                    }
                }
                reasoning_content
                    .get_or_insert_with(String::new)
                    .push_str(s);
                on_reasoning(s);
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
    usage: &mut Option<TokenUsage>,
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

    if let Some(usage_obj) = event.get("usage") {
        let prompt = usage_obj
            .get("prompt_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;
        let completion = usage_obj
            .get("completion_tokens")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;
        let total = usage_obj
            .get("total_tokens")
            .and_then(|v| v.as_u64())
            .map(|v| v as usize)
            .unwrap_or(prompt + completion);
        if prompt > 0 || total > 0 {
            *usage = Some(TokenUsage {
                prompt_tokens: prompt,
                completion_tokens: completion,
                total_tokens: total,
            });
        }
    }

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
                id: format!("call_{idx}"),
                name: String::new(),
                arguments: String::new(),
                extra_fields: serde_json::Map::new(),
                func_extra_fields: serde_json::Map::new(),
            });
            if let Some(id) = tc.get("id").and_then(|v| v.as_str()) {
                entry.id = id.to_string();
            }
            if let Some(obj) = tc.as_object() {
                for (k, v) in obj {
                    if k != "index" && k != "id" && k != "type" && k != "function" {
                        entry.extra_fields.insert(k.clone(), v.clone());
                    }
                }
            }
            if let Some(func) = tc.get("function") {
                if let Some(name) = func.get("name").and_then(|v| v.as_str()) {
                    entry.name = name.to_string();
                }
                if let Some(args) = func.get("arguments").and_then(|v| v.as_str()) {
                    entry.arguments.push_str(args);
                    on_tool_args(&entry.id, &entry.arguments);
                }
                if let Some(fobj) = func.as_object() {
                    for (k, v) in fobj {
                        if k != "name" && k != "arguments" {
                            entry.func_extra_fields.insert(k.clone(), v.clone());
                        }
                    }
                }
            }
        }
    }

    if let Some(fc) = delta.get("function_call") {
        let entry = tool_acc.entry(0).or_insert_with(|| ToolCallAcc {
            id: "call_0".to_string(),
            name: String::new(),
            arguments: String::new(),
            extra_fields: serde_json::Map::new(),
            func_extra_fields: serde_json::Map::new(),
        });
        if let Some(name) = fc.get("name").and_then(|v| v.as_str()) {
            entry.name = name.to_string();
        }
        if let Some(args) = fc.get("arguments").and_then(|v| v.as_str()) {
            entry.arguments.push_str(args);
            on_tool_args(&entry.id, &entry.arguments);
        }
        if let Some(fc_obj) = fc.as_object() {
            for (k, v) in fc_obj {
                if k != "name" && k != "arguments" {
                    entry.func_extra_fields.insert(k.clone(), v.clone());
                }
            }
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

    #[test]
    fn test_in_text_thought_tags_do_not_hijack_content() {
        use super::process_text_chunk;

        let mut content = String::new();
        let mut reasoning_content: Option<String> = None;
        let mut reasoning_name: Option<String> = None;
        let mut has_seen_reasoning = false;
        let mut in_thought_tag = false;
        let mut thought_buf = String::new();

        let noop_delta = |_s: &str| {};
        let noop_reasoning = |_s: &str| {};
        let noop_reasoning_name = |_s: &str| {};
        let noop_reasoning_end = || {};

        let text = "* Парсер отслеживает теги типа `<think>` или `<thought>`. Все работает хорошо.";
        process_text_chunk(
            text,
            false,
            &mut content,
            &mut reasoning_content,
            &mut reasoning_name,
            &mut has_seen_reasoning,
            &mut in_thought_tag,
            &mut thought_buf,
            &noop_delta,
            &noop_reasoning,
            &noop_reasoning_name,
            &noop_reasoning_end,
        );

        assert_eq!(content, text);
        assert!(!in_thought_tag);
        assert!(reasoning_content.is_none());
    }
}
