use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};

// ── Types (mirror TypeScript types via camelCase serde) ──

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub api_url: Option<String>,
    pub provider_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub type_: String,
    pub function: ToolDefFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDefFunction {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantTurn {
    pub content: String,
    pub tool_calls: Vec<ToolCall>,
    pub reasoning_content: Option<String>,
}

// ── Heuristics ──

pub fn supports_vision(model: &str) -> bool {
    let m = model.to_lowercase();
    if m.starts_with("gpt-4o") || m.starts_with("gpt-4-vision") || m.starts_with("gpt-4-turbo") {
        return true;
    }
    if m.contains("claude") && (m.contains("opus") || m.contains("sonnet")) {
        return true;
    }
    if m.contains("llama") && m.contains("vision") {
        return true;
    }
    if m.contains("gemini") && (m.contains("pro") || m.contains("flash")) {
        return true;
    }
    if m.contains("pixtral") || m.contains("llava") {
        return true;
    }
    false
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
                                "text" => p.get("text").and_then(|v| v.as_str()).map(|s| s.to_string()),
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
    let tail: Vec<ChatMessage> = messages.into_iter().skip(total.saturating_sub(keep)).collect();

    // Collect valid tool_call_ids from assistant messages in the tail
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
    });

    // Only keep tool messages that have a corresponding assistant with tool_calls
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

// ── Convert ChatMessage to API JSON (snake_case) ──

fn messages_to_api_json(messages: Vec<ChatMessage>) -> Vec<serde_json::Value> {
    messages
        .into_iter()
        .map(|m| {
            let mut obj = serde_json::Map::new();
            obj.insert(
                "role".to_string(),
                serde_json::Value::String(m.role),
            );
            if let Some(content) = m.content {
                obj.insert("content".to_string(), content);
            }
            if let Some(name) = m.name {
                obj.insert(
                    "name".to_string(),
                    serde_json::Value::String(name),
                );
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

// ── SSE parsing helper types ──

struct ToolCallAcc {
    id: String,
    name: String,
    arguments: String,
}

// ── Core streaming (retry loop + HTTP) ──

pub async fn stream_chat(
    config: &LlmConfig,
    messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
    cancel: &AtomicBool,
    client: &reqwest::Client,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
) -> Result<AssistantTurn, String> {
    let mut current_messages = if messages.len() > 20 {
        trim_messages(messages, 15)
    } else {
        messages
    };

    let max_retries = 3;

    for attempt in 0..max_retries {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        let outbound_messages = if supports_vision(&config.model) {
            current_messages.clone()
        } else {
            flatten_for_text_only(current_messages.clone())
        };

        let (url, headers) = build_request(config);

        let mut body = serde_json::json!({
            "model": config.model,
            "messages": messages_to_api_json(outbound_messages),
            "stream": true,
        });
        if !tools.is_empty() {
            body["tools"] = serde_json::json!(tools);
            if config.base_url.contains("models.github.ai") {
                body["tool_choice"] = serde_json::json!("none");
            } else {
                body["tool_choice"] = serde_json::json!("auto");
            }
        }

        let req = client.post(&url).headers(headers).json(&body);

        match req.send().await {
            Ok(res) => {
                let status = res.status();

                if status == 429 || status == 413 {
                    let status_val = status.as_u16();
                    let mut wait_ms: u64 = 5000;

                    // Read headers before consuming body
                    let retry_after_secs = res
                        .headers()
                        .get(reqwest::header::RETRY_AFTER)
                        .and_then(|v| v.to_str().ok())
                        .and_then(|v| v.parse::<f64>().ok());

                    if let Ok(text) = res.text().await {
                        if let Some(secs_str) = parse_retry_after_body(&text) {
                            if let Ok(secs) = secs_str.parse::<f64>() {
                                wait_ms = (secs * 1000.0).ceil() as u64 + 500;
                            }
                        }
                        if status_val == 413 {
                            on_delta("[context too long, trimming history…]");
                            current_messages = trim_messages(current_messages, 10);
                            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
                            continue;
                        }
                    }

                    if let Some(secs) = retry_after_secs {
                        wait_ms = (secs * 1000.0).ceil() as u64 + 500;
                    }

                    wait_ms = wait_ms.min(60000);
                    on_delta(&format!(
                        "[rate limited, retrying in {}s…]",
                        (wait_ms as f64 / 1000.0).ceil()
                    ));
                    tokio::time::sleep(std::time::Duration::from_millis(wait_ms)).await;
                    continue;
                }

                if !status.is_success() {
                    let text = res.text().await.unwrap_or_default();
                    let detail = extract_error_detail(&text);
                    return Err(format!("LLM request failed: {status}\n{detail}"));
                }

                return parse_sse_stream(res, cancel, on_delta, on_reasoning, on_reasoning_end).await;
            }
            Err(e) => {
                if attempt == max_retries - 1 {
                    return Err(format!(
                        "Fetch failed: {}. Check your internet connection or API endpoint.",
                        e
                    ));
                }
                tokio::time::sleep(std::time::Duration::from_secs(1 + attempt as u64)).await;
            }
        }
    }

    Err("Rate limit: too many retries. Try again in a minute.".to_string())
}

fn build_request(config: &LlmConfig) -> (String, reqwest::header::HeaderMap) {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        "application/json".parse().unwrap(),
    );

    let is_github = config.base_url.contains("models.github.ai");
    let should_proxy = !is_github && config.api_url.is_some() && config.provider_id.is_some();

    let url = if should_proxy {
        let base = config.api_url.as_ref().unwrap().trim_end_matches('/');
        let pid = config.provider_id.as_ref().unwrap();
        headers.insert("x-provider-base-url", config.base_url.parse().unwrap());
        headers.insert("x-api-key", config.api_key.parse().unwrap());
        format!("{base}/v2/{pid}/chat/completions")
    } else {
        let auth_val = format!("Bearer {}", config.api_key);
        headers.insert(reqwest::header::AUTHORIZATION, auth_val.parse().unwrap());
        let is_google = config.base_url.contains("generativelanguage.googleapis.com");
        let is_github = config.base_url.contains("models.github.ai");
        if is_google {
            format!(
                "{}/chat/completions?key={}",
                config.base_url.trim_end_matches('/'),
                config.api_key
            )
        } else if is_github {
            headers.insert("Accept", "application/vnd.github+json".parse().unwrap());
            headers.insert("X-GitHub-Api-Version", "2026-03-10".parse().unwrap());
            format!(
                "{}/inference/chat/completions",
                config.base_url.trim_end_matches('/')
            )
        } else {
            format!(
                "{}/chat/completions",
                config.base_url.trim_end_matches('/')
            )
        }
    };

    (url, headers)
}

fn extract_error_detail(text: &str) -> String {
    if let Ok(j) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(d) = j.get("detail").and_then(|v| v.as_str()) {
            return d.to_string();
        }
        if let Some(e) = j.get("error") {
            if let Some(s) = e.as_str() {
                return s.to_string();
            }
            return e.to_string();
        }
    }
    text.to_string()
}

fn parse_retry_after_body(text: &str) -> Option<&str> {
    let prefix = "try again in ";
    let suffix = "s";
    let start = text.find(prefix)?;
    let rest = &text[start + prefix.len()..];
    let end = rest.find(suffix).unwrap_or(rest.len());
    let num_str = &rest[..end];
    if num_str.is_empty() { None } else { Some(num_str) }
}

// ── SSE stream parsing ──

async fn parse_sse_stream(
    mut res: reqwest::Response,
    cancel: &AtomicBool,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
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
        }
    }
}
