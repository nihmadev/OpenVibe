use crate::chat::ChatMessage;

pub fn max_context_tokens(model: &str) -> usize {
    let m = model.to_lowercase();
    if m.contains("gpt-4o") || m.contains("gpt-4-vision") || m.contains("gpt-4-turbo") {
        return 128000;
    }
    if m.contains("gpt-4") {
        return 8192;
    }
    if m.contains("gpt-3.5") || m.contains("gpt-35") {
        return 16384;
    }
    if m.contains("claude") {
        return 200000;
    }
    if m.contains("gemini") {
        return 1048576;
    }
    if m.contains("deepseek") {
        return 65536;
    }
    if m.contains("llama") {
        return 128000;
    }
    if m.contains("mistral") || m.contains("mixtral") {
        return 32000;
    }
    if m.contains("command-r") || m.contains("command-r7b") || m.contains("command-r+") {
        return 128000;
    }
    128000
}

fn estimate_text_tokens(text: &str) -> usize {
    if text.is_empty() {
        return 0;
    }
    let word_count = text.split_whitespace().count() as f64;
    let non_ascii = text.chars().filter(|c| *c > '\u{007F}').count() as f64;
    let min_est = text.len() as f64 / 4.0;
    let est = word_count * 1.3 + non_ascii * 0.8;
    est.max(min_est).ceil() as usize
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
                    1000
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
    let used = estimate_tokens(messages);
    let max = max_context_tokens(model);
    let percent = if max > 0 {
        ((used as f64 / max as f64) * 100.0).round().clamp(1.0, 100.0) as usize
    } else {
        1
    };
    ContextUsage {
        used_tokens: used,
        max_tokens: max,
        percent,
    }
}
