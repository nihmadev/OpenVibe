use serde_json::Value;

use super::accumulator::{Accumulator, ToolKey};
use super::frame::SseEvent;
use agent_api::TokenUsage;

pub(super) fn is_event_type(event: &str) -> bool {
    matches!(
        event,
        "message_start"
            | "content_block_start"
            | "content_block_delta"
            | "content_block_stop"
            | "message_delta"
            | "message_stop"
            | "ping"
            | "error"
    )
}

pub(super) fn decode(event: &SseEvent, accumulator: &mut Accumulator<'_>) -> Result<(), String> {
    let event_type = event
        .event
        .as_deref()
        .ok_or_else(|| "Anthropic SSE event is missing the event field".to_string())?;
    let payload: Value = serde_json::from_str(&event.data).map_err(|error| {
        tracing::warn!(event_type, error = %error, "Malformed Anthropic SSE JSON payload");
        format!(
            "Malformed JSON in Anthropic {event_type} event: {error}; payload={}",
            snippet(&event.data)
        )
    })?;

    match event_type {
        "message_start" => {
            if let Some(usage) = payload.get("message").and_then(|value| value.get("usage")) {
                accumulator.merge_usage(parse_usage(usage));
            }
        }
        "content_block_start" => content_block_start(&payload, accumulator)?,
        "content_block_delta" => content_block_delta(&payload, accumulator)?,
        "message_delta" => {
            if let Some(reason) = payload
                .get("delta")
                .and_then(|value| value.get("stop_reason"))
                .and_then(Value::as_str)
            {
                accumulator.set_finish_reason(reason);
            }
            if let Some(usage) = payload.get("usage") {
                accumulator.merge_usage(parse_usage(usage));
            }
        }
        "error" => {
            let error = payload.get("error").unwrap_or(&payload);
            return Err(format!(
                "Anthropic stream error: {}",
                snippet(&error.to_string())
            ));
        }
        "content_block_stop" | "message_stop" | "ping" => {}
        _ => return Err(format!("Unsupported Anthropic SSE event: {event_type}")),
    }
    Ok(())
}

fn content_block_start(payload: &Value, accumulator: &mut Accumulator<'_>) -> Result<(), String> {
    let index = index(payload)?;
    let block = payload
        .get("content_block")
        .and_then(Value::as_object)
        .ok_or_else(|| "Anthropic content_block_start is missing content_block".to_string())?;
    match block.get("type").and_then(Value::as_str) {
        Some("text") => {
            if let Some(text) = block.get("text").and_then(Value::as_str) {
                accumulator.text(text, false);
            }
        }
        Some("thinking") | Some("redacted_thinking") => {
            if let Some(text) = block
                .get("thinking")
                .or_else(|| block.get("text"))
                .and_then(Value::as_str)
            {
                accumulator.text(text, true);
            }
        }
        Some("tool_use") => {
            let key = ToolKey::Anthropic(index);
            accumulator.start_tool(
                key.clone(),
                block.get("id").and_then(Value::as_str),
                block.get("name").and_then(Value::as_str),
                Some("function"),
            );
            if let Some(input) = block
                .get("input")
                .filter(|value| !value.as_object().is_some_and(serde_json::Map::is_empty))
            {
                accumulator.tool_arguments(&key, &input.to_string())?;
            }
        }
        Some(other) => return Err(format!("Unsupported Anthropic content block type: {other}")),
        None => return Err("Anthropic content block is missing type".to_string()),
    }
    Ok(())
}

fn content_block_delta(payload: &Value, accumulator: &mut Accumulator<'_>) -> Result<(), String> {
    let index = index(payload)?;
    let delta = payload
        .get("delta")
        .and_then(Value::as_object)
        .ok_or_else(|| "Anthropic content_block_delta is missing delta".to_string())?;
    match delta.get("type").and_then(Value::as_str) {
        Some("text_delta") => accumulator.text(
            delta.get("text").and_then(Value::as_str).unwrap_or(""),
            false,
        ),
        Some("thinking_delta") => accumulator.text(
            delta.get("thinking").and_then(Value::as_str).unwrap_or(""),
            true,
        ),
        Some("input_json_delta") => {
            let partial = delta
                .get("partial_json")
                .and_then(Value::as_str)
                .ok_or_else(|| "Anthropic input_json_delta is missing partial_json".to_string())?;
            accumulator.tool_arguments(&ToolKey::Anthropic(index), partial)?;
        }
        Some("signature_delta") => {}
        Some(other) => return Err(format!("Unsupported Anthropic delta type: {other}")),
        None => return Err("Anthropic content block delta is missing type".to_string()),
    }
    Ok(())
}

fn index(payload: &Value) -> Result<usize, String> {
    payload
        .get("index")
        .and_then(Value::as_u64)
        .map(|value| value as usize)
        .ok_or_else(|| "Anthropic content block event is missing index".to_string())
}

fn parse_usage(value: &Value) -> TokenUsage {
    let input = value
        .get("input_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    let output = value
        .get("output_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    TokenUsage {
        prompt_tokens: input,
        completion_tokens: output,
        total_tokens: input + output,
        cache_creation_input_tokens: value
            .get("cache_creation_input_tokens")
            .and_then(Value::as_u64)
            .map(|value| value as usize),
        cache_read_input_tokens: value
            .get("cache_read_input_tokens")
            .and_then(Value::as_u64)
            .map(|value| value as usize),
    }
}

fn snippet(payload: &str) -> String {
    payload.chars().take(256).collect()
}
