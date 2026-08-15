use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::cancel::{cancellable_sleep, wait_for_cancel};
use crate::chat::{AssistantTurn, ChatMessage};
use crate::config::LlmConfig;
use crate::definition::ToolDefinition;
use crate::sse::parse_sse_stream;
use crate::token::max_context_tokens;
use crate::transform::{
    flatten_for_text_only, messages_to_api_json_with_cache, supports_vision, trim_messages,
    trim_messages_to_budget,
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
    // Emergency safety valve: trim by estimated token footprint against the
    // model's context window (keep ~10% headroom for the response). Proactive
    // LLM compaction happens earlier in the agent loop; this only guards
    // against overflowing the provider limit.
    let token_budget = (max_context_tokens(&config.model) as f64 * 0.9) as usize;
    let mut current_messages = trim_messages_to_budget(messages, token_budget);

    let max_retries = 3;

    // Serialize the request body ONCE, before the retry loop. Cloning `Bytes`
    // is a refcount bump, so retries reuse the same allocation instead of
    // re-cloning the whole message history (including base64 images) and
    // rebuilding/reserializing a serde_json::Value tree per attempt.
    // Rebuilt only on the 413 path, where messages actually change.
    let mut body_bytes = build_body_bytes(config, &current_messages, &tools)?;

    for attempt in 0..max_retries {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        let (url, headers) = build_request(config);
        let req = client.post(&url).headers(headers).body(body_bytes.clone());

        let send_result = tokio::select! {
            biased;
            _ = wait_for_cancel(cancel) => {
                return Err("Aborted".to_string());
            }
            result = req.send() => result,
        };

        match send_result {
            Ok(res) => {
                let status = res.status();

                if status == 429 || status == 413 {
                    let status_val = status.as_u16();
                    let mut wait_ms: u64 = 1500;

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
                            current_messages = trim_messages(current_messages, 10);
                            body_bytes = build_body_bytes(config, &current_messages, &tools)?;
                            cancellable_sleep(Duration::from_millis(1000), cancel).await?;
                            continue;
                        }
                    }

                    if let Some(secs) = retry_after_secs {
                        wait_ms = (secs * 1000.0).ceil() as u64 + 500;
                    }

                    wait_ms = wait_ms.min(60000);
                    cancellable_sleep(Duration::from_millis(wait_ms), cancel).await?;
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
                // Stale pooled connection (server closed the idle socket
                // between warmer probes): the request never reached the
                // server, so retrying immediately is safe and almost always
                // succeeds on a fresh connection. Waiting 1.5s here was the
                // single biggest avoidable TTFT hit.
                if attempt == 0 && is_connection_error(&e) {
                    continue;
                }
                // Exponential backoff + jitter: 1.5s, 3s, 6s
                let ms = 1500u64 * 2u64.pow(attempt as u32);
                let jitter = (SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos() as u64)
                    % 500;
                cancellable_sleep(Duration::from_millis(ms + jitter), cancel).await?;
            }
        }
    }

    Err("Rate limit: too many retries. Try again in a minute.".to_string())
}

/// Builds and serializes the chat-completions request body to bytes once.
/// `reqwest::Body` accepts `Vec<u8>` via `bytes::Bytes`, cloned by refcount.
fn build_body_bytes(
    config: &LlmConfig,
    current_messages: &[ChatMessage],
    tools: &[ToolDefinition],
) -> Result<bytes::Bytes, String> {
    let outbound_messages = if supports_vision(&config.model) {
        current_messages.to_vec()
    } else {
        flatten_for_text_only(current_messages.to_vec())
    };

    if is_direct_anthropic(config) {
        return build_anthropic_body(config, &outbound_messages, tools, true);
    }

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": messages_to_api_json_with_cache(
            outbound_messages,
            false,
            provider_kind(config).round_trips_native_reasoning(),
        ),
        "stream": true,
        "stream_options": { "include_usage": true },
    });
    apply_reasoning_params(config, &mut body);
    if supports_prompt_cache_key(config) {
        if let Some(key) = config.prompt_cache_key.as_deref() {
            body["prompt_cache_key"] = serde_json::json!(key);
        }
    }
    if !tools.is_empty() {
        body["tools"] = serde_json::json!(tools);
        body["tool_choice"] = serde_json::json!("auto");
    }

    serde_json::to_vec(&body)
        .map(bytes::Bytes::from)
        .map_err(|e| format!("Failed to serialize request body: {e}"))
}

fn is_direct_anthropic(config: &LlmConfig) -> bool {
    !should_route_via_proxy(config) && config.base_url.contains("api.anthropic.com")
}

fn build_anthropic_body(
    config: &LlmConfig,
    messages: &[ChatMessage],
    tools: &[ToolDefinition],
    use_cache_markers: bool,
) -> Result<bytes::Bytes, String> {
    let mut system = Vec::new();
    let mut outbound: Vec<serde_json::Value> = Vec::new();
    for message in messages {
        if message.role == "system" {
            if let Some(content) = &message.content {
                system.extend(anthropic_content_blocks(content, use_cache_markers)?);
            }
            continue;
        }

        if message.role == "tool" {
            let tool_use_id = message.tool_call_id.as_deref().ok_or_else(|| {
                "Anthropic tool result message is missing tool_call_id".to_string()
            })?;
            let content = message
                .content
                .as_ref()
                .and_then(serde_json::Value::as_str)
                .unwrap_or("");
            let block = serde_json::json!({
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": content,
            });
            if let Some(blocks) = outbound
                .last_mut()
                .filter(|value| {
                    value.get("role").and_then(serde_json::Value::as_str) == Some("user")
                })
                .and_then(|value| value.get_mut("content"))
                .and_then(serde_json::Value::as_array_mut)
            {
                blocks.push(block);
            } else {
                outbound.push(serde_json::json!({
                    "role": "user",
                    "content": [block],
                }));
            }
            continue;
        }

        let mut blocks = message
            .content
            .as_ref()
            .map(|content| anthropic_content_blocks(content, false))
            .transpose()?
            .unwrap_or_default();
        if message.role == "assistant" {
            if let Some(tool_calls) = &message.tool_calls {
                for call in tool_calls {
                    let input = if call.function.arguments.trim().is_empty() {
                        serde_json::json!({})
                    } else {
                        serde_json::from_str(&call.function.arguments).map_err(|error| {
                            format!(
                                "Cannot send Anthropic tool call {} with invalid arguments: {error}",
                                call.id
                            )
                        })?
                    };
                    blocks.push(serde_json::json!({
                        "type": "tool_use",
                        "id": call.id,
                        "name": call.function.name,
                        "input": input,
                    }));
                }
            }
        }
        outbound.push(serde_json::json!({
            "role": message.role,
            "content": blocks,
        }));
    }

    // Mirror OpenCode's cache placement for Anthropic: the static tools and
    // system prefix, plus the latest user boundary that all intra-turn tool
    // follow-ups share.
    if use_cache_markers {
        if let Some(last_user) = outbound
            .iter_mut()
            .rev()
            .find(|message| message.get("role").and_then(serde_json::Value::as_str) == Some("user"))
            .and_then(|message| message.get_mut("content"))
            .and_then(serde_json::Value::as_array_mut)
            .and_then(|blocks| blocks.last_mut())
            .and_then(serde_json::Value::as_object_mut)
        {
            last_user.insert(
                "cache_control".to_string(),
                serde_json::json!({"type": "ephemeral"}),
            );
        }
    }

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": outbound,
        "max_tokens": 8192,
        "stream": true,
    });
    if !system.is_empty() {
        body["system"] = serde_json::Value::Array(system);
    }
    if !tools.is_empty() {
        let mut native_tools: Vec<serde_json::Value> = tools
            .iter()
            .map(|tool| {
                serde_json::json!({
                    "name": tool.function.name,
                    "description": tool.function.description,
                    "input_schema": tool.function.parameters,
                })
            })
            .collect();
        if use_cache_markers {
            if let Some(last_tool) = native_tools
                .last_mut()
                .and_then(serde_json::Value::as_object_mut)
            {
                last_tool.insert(
                    "cache_control".to_string(),
                    serde_json::json!({"type": "ephemeral"}),
                );
            }
        }
        body["tools"] = serde_json::Value::Array(native_tools);
    }
    serde_json::to_vec(&body)
        .map(bytes::Bytes::from)
        .map_err(|error| format!("Failed to serialize Anthropic request body: {error}"))
}

fn anthropic_content_blocks(
    content: &serde_json::Value,
    cache: bool,
) -> Result<Vec<serde_json::Value>, String> {
    let mut blocks = match content {
        serde_json::Value::String(text) => vec![serde_json::json!({
            "type": "text",
            "text": text,
        })],
        serde_json::Value::Array(parts) => parts
            .iter()
            .map(
                |part| match part.get("type").and_then(serde_json::Value::as_str) {
                    Some("text") => Ok(serde_json::json!({
                        "type": "text",
                        "text": part.get("text").and_then(serde_json::Value::as_str).unwrap_or(""),
                    })),
                    Some("image_url") => {
                        let url = part
                            .get("image_url")
                            .and_then(|value| value.get("url"))
                            .and_then(serde_json::Value::as_str)
                            .ok_or_else(|| {
                                "Anthropic image content is missing image_url.url".to_string()
                            })?;
                        let data = url
                            .strip_prefix("data:")
                            .and_then(|value| value.split_once(';'));
                        let (media_type, encoded) = data
                            .and_then(|(media_type, rest)| {
                                rest.strip_prefix("base64,").map(|data| (media_type, data))
                            })
                            .ok_or_else(|| {
                                "Direct Anthropic requests require base64 data URLs for images"
                                    .to_string()
                            })?;
                        Ok(serde_json::json!({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": encoded,
                            },
                        }))
                    }
                    Some(other) => {
                        Err(format!("Unsupported Anthropic content block type: {other}"))
                    }
                    None => Err("Anthropic content block is missing type".to_string()),
                },
            )
            .collect::<Result<Vec<_>, _>>()?,
        _ => return Err("Anthropic message content must be a string or array".to_string()),
    };
    if cache {
        if let Some(last) = blocks.last_mut().and_then(serde_json::Value::as_object_mut) {
            last.insert(
                "cache_control".to_string(),
                serde_json::json!({"type": "ephemeral"}),
            );
        }
    }
    Ok(blocks)
}

/// True for transport-level failures where the request never reached the
/// server (dead pooled connection, reset during send/connect). These are
/// safe to retry immediately without backoff.
fn is_connection_error(e: &reqwest::Error) -> bool {
    if e.is_connect() || e.is_timeout() {
        return true;
    }
    // Reset/close of a pooled connection surfaces as a hyper IncompleteMessage
    // or a request error wrapping an io reset; match on the source chain.
    let mut source = std::error::Error::source(e);
    while let Some(err) = source {
        if let Some(io) = err.downcast_ref::<std::io::Error>() {
            return matches!(
                io.kind(),
                std::io::ErrorKind::ConnectionReset
                    | std::io::ErrorKind::ConnectionAborted
                    | std::io::ErrorKind::BrokenPipe
                    | std::io::ErrorKind::UnexpectedEof
            );
        }
        let msg = err.to_string();
        if msg.contains("IncompleteMessage") || msg.contains("connection closed") {
            return true;
        }
        source = std::error::Error::source(err);
    }
    false
}

/// OpenRouter accepts the stable OpenAI-style session key on its chat route.
/// The key lets it reuse a matching prefix without placing Anthropic-only
/// `cache_control` objects into an OpenAI-compatible message body.
fn supports_prompt_cache_key(config: &LlmConfig) -> bool {
    config.provider_id.as_deref() == Some("openrouter")
        || config.base_url.to_lowercase().contains("openrouter.ai")
}

/// Providers whose OpenAI-compatible chat endpoint accepts the flat
/// `reasoning_effort` field. Everything else gets no reasoning params rather
/// than an unsupported field that some providers reject with a hard error.
fn provider_kind(config: &LlmConfig) -> ReasoningTransport {
    let base = config.base_url.to_lowercase();
    let pid = config.provider_id.as_deref().unwrap_or("");

    if pid == "deepseek" || base.contains("api.deepseek.com") {
        return ReasoningTransport::DeepSeek;
    }
    if pid == "openrouter" || base.contains("openrouter.ai") {
        return ReasoningTransport::OpenRouterReasoningObject;
    }
    let effort_providers = [
        "openai",
        "groq",
        "cerebras",
        "opencode",
        "github",
        "together",
        "fireworks",
        "mistral",
        "xai",
        "deepinfra",
        "hyperbolic",
        "nvidia",
        "sambanova",
        "siliconcloud",
    ];
    if effort_providers.contains(&pid) {
        return ReasoningTransport::FlatEffort;
    }
    // Custom/unknown endpoints: send flat effort only if user explicitly set
    // one; most OpenAI-compatible servers silently ignore unknown fields, but
    // we keep the same behavior as known effort providers.
    ReasoningTransport::FlatEffort
}

enum ReasoningTransport {
    /// `reasoning_effort: "high"` (OpenAI-compatible chat completions).
    FlatEffort,
    /// DeepSeek thinking mode: `thinking: {type: enabled}` + `reasoning_effort`
    /// (low/medium are mapped to high server-side; `max` is valid).
    DeepSeek,
    /// OpenRouter: `reasoning: { enabled: true, effort: ... }` object.
    OpenRouterReasoningObject,
}

impl ReasoningTransport {
    /// Whether the provider requires an assistant's native reasoning field to
    /// be replayed verbatim on a follow-up turn (notably after a tool call).
    ///
    /// This is a transport capability rather than an inference from a stream:
    /// servers can emit reasoning deltas while rejecting `reasoning_content`
    /// in messages sent back to them.
    fn round_trips_native_reasoning(self) -> bool {
        matches!(self, Self::DeepSeek)
    }
}

fn apply_reasoning_params(config: &LlmConfig, body: &mut serde_json::Value) {
    let effort = match config.reasoning_effort.as_deref() {
        Some(e) if !e.is_empty() => e,
        _ => return,
    };

    match provider_kind(config) {
        ReasoningTransport::FlatEffort => {
            body["reasoning_effort"] = serde_json::json!(effort);
        }
        ReasoningTransport::DeepSeek => {
            // DeepSeek requires the thinking toggle alongside the effort;
            // effort alone does not enable thinking mode via OpenAI SDK shape.
            body["thinking"] = serde_json::json!({ "type": "enabled" });
            body["reasoning_effort"] = serde_json::json!(effort);
        }
        ReasoningTransport::OpenRouterReasoningObject => {
            body["reasoning"] = serde_json::json!({
                "enabled": true,
                "effort": effort,
            });
        }
    }
}

fn safe_header_val(val: &str) -> reqwest::header::HeaderValue {
    let sanitized: String = val.chars().filter(|c| !c.is_control()).collect();
    reqwest::header::HeaderValue::from_str(&sanitized)
        .unwrap_or_else(|_| reqwest::header::HeaderValue::from_static(""))
}

/// Whether chat requests are routed through the regional proxy.
///
/// The regional proxy only supports the built-in provider routes and an
/// allow-list of upstream hosts. Custom providers are stored with IDs such
/// as `p_...`; routing those through /v3 would make the proxy reject valid
/// arbitrary OpenAI-compatible endpoints with the misleading
/// `x-provider-base-url header required` response. Keep custom endpoints
/// direct (the models command already follows this behavior).
///
/// The proxy exists ONLY to reach providers that geo-block certain regions.
/// Globally reachable providers (opencode Zen, OpenRouter, DeepSeek — all
/// Cloudflare/global-edge fronted) are deliberately NOT routed: an extra
/// VPS hop adds latency and caps streaming throughput at the VPS's capacity
/// for zero benefit. `ollama` is a localhost endpoint and can never be
/// proxied.
fn should_route_via_proxy(config: &LlmConfig) -> bool {
    let is_github = config.base_url.contains("models.github.ai");
    let proxy_provider = config.provider_id.as_deref().is_some_and(|id| {
        matches!(
            id,
            "anthropic"
                | "openai"
                | "google"
                | "groq"
                | "cerebras"
                | "moonshot"
                | "zai"
                | "github"
                | "together"
                | "fireworks"
                | "mistral"
                | "xai"
                | "cohere"
                | "qwen"
                | "azure-openai"
                | "amazon-bedrock"
                | "huggingface"
                | "replicate"
                | "deepinfra"
                | "perplexity"
                | "anyscale"
                | "vercel"
                | "fal"
                | "baseten"
                | "hyperbolic"
                | "minimax"
                | "nvidia"
                | "sambanova"
                | "siliconcloud"
        )
    });
    !is_github && proxy_provider && config.api_url.is_some()
}

/// The origin (scheme://host[:port]) that chat completions actually connect
/// to: the regional proxy when enabled, otherwise the provider base URL.
/// Used to pre-warm the TCP/TLS connection before the user sends a message.
pub fn effective_origin(config: &LlmConfig) -> Option<String> {
    let base = if should_route_via_proxy(config) {
        config.api_url.as_deref()?
    } else {
        &config.base_url
    };
    let rest = base
        .strip_prefix("https://")
        .map(|r| ("https://", r))
        .or_else(|| base.strip_prefix("http://").map(|r| ("http://", r)))?;
    let host = rest.1.split('/').next()?;
    if host.is_empty() {
        return None;
    }
    Some(format!("{}{}", rest.0, host))
}

fn build_request(config: &LlmConfig) -> (String, reqwest::header::HeaderMap) {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        reqwest::header::HeaderValue::from_static("application/json"),
    );

    let url = if should_route_via_proxy(config) {
        let base = config.api_url.as_ref().unwrap().trim_end_matches('/');
        let pid = config.provider_id.as_ref().unwrap();
        headers.insert("x-provider-base-url", safe_header_val(&config.base_url));
        headers.insert("x-api-key", safe_header_val(&config.api_key));
        format!("{base}/v3/{pid}/chat/completions")
    } else if is_direct_anthropic(config) {
        headers.insert("x-api-key", safe_header_val(&config.api_key));
        headers.insert(
            "anthropic-version",
            reqwest::header::HeaderValue::from_static("2023-06-01"),
        );
        format!("{}/messages", config.base_url.trim_end_matches('/'))
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

#[cfg(test)]
mod tests {
    use super::*;

    fn cfg(provider_id: &str, base_url: &str, effort: Option<&str>) -> LlmConfig {
        LlmConfig {
            api_key: "k".to_string(),
            base_url: base_url.to_string(),
            model: "m".to_string(),
            api_url: None,
            provider_id: if provider_id.is_empty() {
                None
            } else {
                Some(provider_id.to_string())
            },
            reasoning_effort: effort.map(|e| e.to_string()),
            prompt_cache_key: None,
        }
    }

    #[test]
    fn deepseek_gets_thinking_toggle_and_effort() {
        let config = cfg("deepseek", "https://api.deepseek.com/v1", Some("high"));
        let mut body = serde_json::json!({});
        apply_reasoning_params(&config, &mut body);
        assert_eq!(body["thinking"]["type"], "enabled");
        assert_eq!(body["reasoning_effort"], "high");
    }

    #[test]
    fn openrouter_gets_reasoning_object() {
        let config = cfg("openrouter", "https://openrouter.ai/api/v1", Some("medium"));
        let mut body = serde_json::json!({});
        apply_reasoning_params(&config, &mut body);
        assert_eq!(body["reasoning"]["enabled"], true);
        assert_eq!(body["reasoning"]["effort"], "medium");
        assert!(body.get("reasoning_effort").is_none());
    }

    #[test]
    fn openai_gets_flat_effort() {
        let config = cfg("openai", "https://api.openai.com/v1", Some("low"));
        let mut body = serde_json::json!({});
        apply_reasoning_params(&config, &mut body);
        assert_eq!(body["reasoning_effort"], "low");
        assert!(body.get("thinking").is_none());
        assert!(body.get("reasoning").is_none());
    }

    #[test]
    fn no_effort_means_no_reasoning_fields() {
        let config = cfg("deepseek", "https://api.deepseek.com/v1", None);
        let mut body = serde_json::json!({});
        apply_reasoning_params(&config, &mut body);
        assert!(body.get("thinking").is_none());
        assert!(body.get("reasoning_effort").is_none());
    }

    #[test]
    fn deepseek_detected_by_base_url_without_provider_id() {
        let config = cfg("", "https://api.deepseek.com/v1", Some("max"));
        let mut body = serde_json::json!({});
        apply_reasoning_params(&config, &mut body);
        assert_eq!(body["thinking"]["type"], "enabled");
        assert_eq!(body["reasoning_effort"], "max");
    }

    #[test]
    fn native_reasoning_history_follows_transport_capability() {
        let messages = vec![ChatMessage {
            role: "assistant".to_string(),
            content: None,
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: Some("private chain of thought".to_string()),
            reasoning_name: None,
            usage: None,
        }];

        let groq = cfg("groq", "https://api.groq.com/openai/v1", Some("medium"));
        let groq_body: serde_json::Value =
            serde_json::from_slice(&build_body_bytes(&groq, &messages, &[]).unwrap()).unwrap();
        assert!(groq_body["messages"][0].get("reasoning_content").is_none());

        let deepseek = cfg("deepseek", "https://api.deepseek.com/v1", Some("medium"));
        let deepseek_body: serde_json::Value =
            serde_json::from_slice(&build_body_bytes(&deepseek, &messages, &[]).unwrap()).unwrap();
        assert_eq!(
            deepseek_body["messages"][0]["reasoning_content"],
            "private chain of thought"
        );
    }

    #[test]
    fn openai_compatible_requests_do_not_receive_anthropic_cache_markers() {
        let custom = cfg("p_custom", "https://example.invalid/v1", None);
        let messages = vec![ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String("stable prefix".to_string())),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }];

        let body: serde_json::Value =
            serde_json::from_slice(&build_body_bytes(&custom, &messages, &[]).unwrap()).unwrap();
        assert_eq!(body["messages"][0]["content"], "stable prefix");
        assert!(!body.to_string().contains("cache_control"));
    }

    #[test]
    fn openrouter_receives_a_stable_prompt_cache_key() {
        let mut config = cfg("openrouter", "https://openrouter.ai/api/v1", None);
        config.prompt_cache_key = Some("openvibe-session-1".to_string());
        let body: serde_json::Value =
            serde_json::from_slice(&build_body_bytes(&config, &[], &[]).unwrap()).unwrap();
        assert_eq!(body["prompt_cache_key"], "openvibe-session-1");
        assert!(!body.to_string().contains("cache_control"));
    }

    #[test]
    fn direct_anthropic_uses_native_url_headers_and_body() {
        let config = cfg("anthropic", "https://api.anthropic.com/v1", None);
        let messages = vec![
            ChatMessage {
                role: "system".to_string(),
                content: Some(serde_json::json!("system")),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
                usage: None,
            },
            ChatMessage {
                role: "user".to_string(),
                content: Some(serde_json::json!("hello")),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
                usage: None,
            },
        ];
        let body = build_body_bytes(&config, &messages, &[]).unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["system"][0]["text"], "system");
        assert_eq!(body["messages"][0]["content"][0]["text"], "hello");
        assert_eq!(body["system"][0]["cache_control"]["type"], "ephemeral");
        assert_eq!(
            body["messages"][0]["content"][0]["cache_control"]["type"],
            "ephemeral"
        );
        assert!(body.get("stream_options").is_none());

        let (url, headers) = build_request(&config);
        assert_eq!(url, "https://api.anthropic.com/v1/messages");
        assert_eq!(headers["x-api-key"], "k");
        assert_eq!(headers["anthropic-version"], "2023-06-01");
        assert!(!headers.contains_key(reqwest::header::AUTHORIZATION));
    }

    #[test]
    fn anthropic_proxy_remains_openai_compatible() {
        let mut config = cfg("anthropic", "https://api.anthropic.com/v1", None);
        config.api_url = Some("https://proxy.example".to_string());
        assert!(!is_direct_anthropic(&config));
        let (url, _) = build_request(&config);
        assert_eq!(url, "https://proxy.example/v3/anthropic/chat/completions");
    }

    #[test]
    fn direct_anthropic_groups_parallel_tool_results() {
        let config = cfg("anthropic", "https://api.anthropic.com/v1", None);
        let messages = ["one", "two"]
            .into_iter()
            .map(|id| ChatMessage {
                role: "tool".to_string(),
                content: Some(serde_json::json!(format!("result {id}"))),
                name: None,
                tool_call_id: Some(id.to_string()),
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
                usage: None,
            })
            .collect::<Vec<_>>();
        let body = build_body_bytes(&config, &messages, &[]).unwrap();
        let body: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(body["messages"].as_array().unwrap().len(), 1);
        assert_eq!(body["messages"][0]["content"].as_array().unwrap().len(), 2);
    }
}
