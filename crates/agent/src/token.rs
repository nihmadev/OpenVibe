use crate::chat::ChatMessage;

pub fn max_context_tokens(model: &str) -> usize {
    let m = model.to_lowercase();
    if m.contains("gemini")
        && (m.contains("pro")
            || m.contains("1.5-pro")
            || m.contains("2.0-pro")
            || m.contains("3.1-pro")
            || m.contains("ultra"))
    {
        return 2097152;
    }
    if m.contains("gemini") {
        return 1048576;
    }
    if m.contains("claude-3-5")
        || m.contains("claude-3-7")
        || m.contains("claude-3")
        || m.contains("claude-sonnet")
        || m.contains("claude-opus")
        || m.contains("claude-haiku")
        || m.contains("claude")
    {
        return 200000;
    }
    if m.contains("gpt-4.5") || m.contains("o3-mini") {
        return 200000;
    }
    if m.contains("gpt-4o")
        || m.contains("gpt-4-vision")
        || m.contains("gpt-4-turbo")
        || m.contains("o1")
        || m.contains("o3")
    {
        return 128000;
    }
    if m.contains("gpt-4") {
        return 8192;
    }
    if m.contains("gpt-3.5") || m.contains("gpt-35") {
        return 16384;
    }
    if m.contains("deepseek") {
        return 128000;
    }
    if m.contains("llama")
        || m.contains("qwen")
        || m.contains("mistral")
        || m.contains("mixtral")
        || m.contains("codestral")
        || m.contains("command-r")
    {
        return 128000;
    }
    128000
}

pub fn estimate_text_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    let char_len = text.chars().count() as f64;
    let byte_len = text.len() as f64;
    let non_ascii = text.chars().filter(|c| *c > '\u{007F}').count() as f64;
    let punctuation_count = text.chars().filter(|c| c.is_ascii_punctuation()).count() as f64;
    let word_count = text.split_whitespace().count() as f64;

    let base_est = word_count * 1.2 + non_ascii * 0.9 + punctuation_count * 0.6;
    let min_est = char_len / 3.5;
    let byte_est = byte_len / 4.0;

    base_est.max(min_est).max(byte_est).ceil() as usize
}

fn estimate_content_tokens(content: &serde_json::Value) -> usize {
    match content {
        serde_json::Value::String(s) => estimate_text_tokens(s),
        serde_json::Value::Array(arr) => arr
            .iter()
            .map(|part| {
                if let Some(text) = part.get("text").and_then(|v| v.as_str()) {
                    estimate_text_tokens(text)
                } else if part.get("image_url").is_some() {
                    512
                } else {
                    0
                }
            })
            .sum(),
        _ => 0,
    }
}

pub fn estimate_tokens(messages: &[ChatMessage]) -> usize {
    let mut total = 0usize;
    for msg in messages {
        total += 4;
        if let Some(ref content) = msg.content {
            total += estimate_content_tokens(content);
        }
        if let Some(ref calls) = msg.tool_calls {
            for call in calls {
                total += estimate_text_tokens(&call.id);
                total += estimate_text_tokens(&call.function.name);
                total += estimate_text_tokens(&call.function.arguments);
            }
        }
        if let Some(ref id) = msg.tool_call_id {
            total += estimate_text_tokens(id);
        }
        if let Some(ref name) = msg.name {
            total += estimate_text_tokens(name);
        }
    }
    total + 10
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContextUsage {
    pub used_tokens: usize,
    pub max_tokens: usize,
    pub percent: usize,
}

pub fn compute_context_usage(messages: &[ChatMessage], model: &str) -> ContextUsage {
    compute_context_usage_with_last(messages, model, None)
}

pub fn compute_context_usage_with_last(
    messages: &[ChatMessage],
    model: &str,
    last_known_prompt_tokens: Option<usize>,
) -> ContextUsage {
    let mut used = estimate_tokens(messages);
    if let Some(real_tokens) = last_known_prompt_tokens {
        if real_tokens > used {
            used = real_tokens;
        }
    }
    let max = max_context_tokens(model);
    let percent = if max > 0 {
        ((used as f64 / max as f64) * 100.0)
            .round()
            .clamp(1.0, 100.0) as usize
    } else {
        1
    };
    ContextUsage {
        used_tokens: used,
        max_tokens: max,
        percent,
    }
}
