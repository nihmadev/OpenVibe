use std::collections::HashSet;

use crate::chat::ChatMessage;

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

pub fn trim_messages(messages: Vec<ChatMessage>, keep: usize) -> Vec<ChatMessage> {
    let total = messages.len();
    if total <= keep + 1 {
        return messages;
    }
    let system = messages.first().filter(|m| m.role == "system").cloned();
    let tail: Vec<ChatMessage> = messages
        .into_iter()
        .skip(total.saturating_sub(keep))
        .collect();

    let valid_ids: HashSet<String> = tail
        .iter()
        .filter(|m| m.role == "assistant")
        .filter_map(|m| m.tool_calls.as_ref())
        .flat_map(|calls| calls.iter().map(|c| c.id.clone()))
        .collect();

    let mut result: Vec<ChatMessage> = Vec::with_capacity(tail.len() + 2);
    if let Some(s) = system {
        result.push(s);
    }
    result.push(ChatMessage {
        role: "user".to_string(),
        content: Some(serde_json::Value::String(
            "[earlier conversation trimmed to fit context limit]".to_string(),
        )),
        name: None,
        tool_call_id: None,
        tool_calls: None,
        reasoning_content: None,
        reasoning_name: None,
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

pub fn messages_to_api_json(messages: Vec<ChatMessage>) -> Vec<serde_json::Value> {
    messages
        .into_iter()
        .map(|m| {
            let mut obj = serde_json::Map::new();
            obj.insert("role".to_string(), serde_json::Value::String(m.role));
            if let Some(content) = m.content {
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
            if let Some(ref reasoning_content) = m.reasoning_content {
                if !reasoning_content.is_empty() {
                    obj.insert(
                        "reasoning_content".to_string(),
                        serde_json::Value::String(reasoning_content.clone()),
                    );
                }
            }
            serde_json::Value::Object(obj)
        })
        .collect()
}
