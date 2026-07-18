use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::chat::{AssistantTurn, ChatMessage};
use crate::config::LlmConfig;
use crate::definition::ToolDefinition;
use crate::sse::parse_sse_stream;
use crate::transform::{
    flatten_for_text_only, messages_to_api_json, supports_vision, trim_messages,
};

#[allow(clippy::too_many_arguments)]
pub async fn stream_chat(
    config: &LlmConfig,
    messages: Vec<ChatMessage>,
    tools: Vec<ToolDefinition>,
    cancel: &AtomicBool,
    client: &reqwest::Client,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_name: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
    on_tool_args: &(dyn Fn(&str, &str) + Send + Sync),
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
            body["tool_choice"] = serde_json::json!("auto");
        }

        let req = client.post(&url).headers(headers).json(&body);

        match req.send().await {
            Ok(res) => {
                let status = res.status();

                if status == 429 || status == 413 {
                    let status_val = status.as_u16();
                    let mut wait_ms: u64 = 5000;

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
                            tokio::time::sleep(Duration::from_millis(1000)).await;
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
                    tokio::time::sleep(Duration::from_millis(wait_ms)).await;
                    continue;
                }

                if !status.is_success() {
                    let text = res.text().await.unwrap_or_default();
                    let detail = extract_error_detail(&text);
                    return Err(format!("LLM request failed: {status}\n{detail}"));
                }

                return parse_sse_stream(
                    res,
                    cancel,
                    on_delta,
                    on_reasoning,
                    on_reasoning_name,
                    on_reasoning_end,
                    on_tool_args,
                )
                .await;
            }
            Err(e) => {
                if attempt == max_retries - 1 {
                    return Err(format!(
                        "Fetch failed: {}. Check your internet connection or API endpoint.",
                        e
                    ));
                }
                // Exponential backoff + jitter: 1.5s, 3s, 6s
                let ms = 1500u64 * 2u64.pow(attempt as u32);
                let jitter = (SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos() as u64)
                    % 500;
                tokio::time::sleep(Duration::from_millis(ms + jitter)).await;
            }
        }
    }

    Err("Rate limit: too many retries. Try again in a minute.".to_string())
}

fn safe_header_val(val: &str) -> reqwest::header::HeaderValue {
    let sanitized: String = val.chars().filter(|c| !c.is_control()).collect();
    reqwest::header::HeaderValue::from_str(&sanitized)
        .unwrap_or_else(|_| reqwest::header::HeaderValue::from_static(""))
}

fn build_request(config: &LlmConfig) -> (String, reqwest::header::HeaderMap) {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );

    let is_github = config.base_url.contains("models.github.ai");
    let should_proxy = !is_github && config.api_url.is_some() && config.provider_id.is_some();

    let url = if should_proxy {
        let base = config.api_url.as_ref().unwrap().trim_end_matches('/');
        let pid = config.provider_id.as_ref().unwrap();
        headers.insert("x-provider-base-url", safe_header_val(&config.base_url));
        headers.insert("x-api-key", safe_header_val(&config.api_key));
        format!("{base}/v3/{pid}/chat/completions")
    } else {
        let auth_val = format!("Bearer {}", config.api_key);
        headers.insert(reqwest::header::AUTHORIZATION, safe_header_val(&auth_val));
        let is_google = config
            .base_url
            .contains("generativelanguage.googleapis.com");
        let is_github = config.base_url.contains("models.github.ai");
        if is_google {
            format!(
                "{}/chat/completions?key={}",
                config.base_url.trim_end_matches('/'),
                config.api_key
            )
        } else if is_github {
            headers.insert(
                "Accept",
                reqwest::header::HeaderValue::from_static("application/vnd.github+json"),
            );
            headers.insert(
                "X-GitHub-Api-Version",
                reqwest::header::HeaderValue::from_static("2026-03-10"),
            );
            format!(
                "{}/inference/chat/completions",
                config.base_url.trim_end_matches('/')
            )
        } else {
            format!("{}/chat/completions", config.base_url.trim_end_matches('/'))
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
    if num_str.is_empty() {
        None
    } else {
        Some(num_str)
    }
}
