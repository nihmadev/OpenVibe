use serde_json::{Map, Value};

use super::accumulator::{Accumulator, ToolKey};
use super::frame::SseEvent;
use crate::chat::TokenUsage;

pub(super) fn decode(event: &SseEvent, accumulator: &mut Accumulator<'_>) -> Result<(), String> {
    let payload = parse_payload(event)?;
    if let Some(error) = payload.get("error") {
        return Err(format!(
            "OpenAI-compatible stream error: {}",
            compact(error)
        ));
    }
    if let Some(usage) = payload.get("usage") {
        accumulator.set_usage(parse_usage(usage));
    }

    let Some(choices) = payload.get("choices") else {
        return Ok(());
    };
    let choices = choices.as_array().ok_or_else(|| {
        event_error(
            event,
            "OpenAI-compatible choices field is not an array",
            None,
        )
    })?;
    if choices.len() > 1 {
        return Err(event_error(
            event,
            &format!(
                "OpenAI-compatible multi-choice response is unsupported (received {})",
                choices.len()
            ),
            None,
        ));
    }
    let Some(choice) = choices.first() else {
        return Ok(());
    };
    let choice = choice
        .as_object()
        .ok_or_else(|| event_error(event, "OpenAI-compatible choice is not an object", None))?;

    if let Some(reason) = choice.get("finish_reason") {
        if let Some(reason) = reason.as_str() {
            accumulator.set_finish_reason(reason);
        } else if !reason.is_null() {
            return Err(event_error(
                event,
                "OpenAI-compatible finish_reason is not a string or null",
                None,
            ));
        }
    }
    let Some(delta) = choice.get("delta") else {
        return Ok(());
    };
    let delta = delta
        .as_object()
        .ok_or_else(|| event_error(event, "OpenAI-compatible delta is not an object", None))?;

    decode_text(delta, accumulator, event)?;
    decode_tools(delta, accumulator, event)?;
    decode_legacy_function(delta, accumulator, event)
}

fn parse_payload(event: &SseEvent) -> Result<Value, String> {
    serde_json::from_str(&event.data).map_err(|error| {
        tracing::warn!(event_type = ?event.event, error = %error, "Malformed SSE JSON payload");
        event_error(event, &format!("Malformed JSON: {error}"), None)
    })
}

fn decode_text(
    delta: &Map<String, Value>,
    accumulator: &mut Accumulator<'_>,
    event: &SseEvent,
) -> Result<(), String> {
    for key in ["reasoning_content", "reasoning"] {
        if let Some(value) = delta.get(key) {
            if value.is_null() {
                continue;
            }
            let text = value.as_str().ok_or_else(|| {
                event_error(
                    event,
                    &format!("OpenAI-compatible {key} delta is not a string or null"),
                    Some(value),
                )
            })?;
            accumulator.text(text, true);
        }
    }
    if let Some(value) = delta.get("content") {
        if !value.is_null() {
            let text = value.as_str().ok_or_else(|| {
                event_error(
                    event,
                    "OpenAI-compatible content delta is not a string or null",
                    Some(value),
                )
            })?;
            accumulator.text(text, false);
        }
    }
    Ok(())
}

fn decode_tools(
    delta: &Map<String, Value>,
    accumulator: &mut Accumulator<'_>,
    event: &SseEvent,
) -> Result<(), String> {
    let Some(tools) = delta.get("tool_calls") else {
        return Ok(());
    };
    let tools = tools
        .as_array()
        .ok_or_else(|| event_error(event, "OpenAI-compatible tool_calls is not an array", None))?;
    for tool in tools {
        let object = tool.as_object().ok_or_else(|| {
            event_error(event, "OpenAI-compatible tool call is not an object", None)
        })?;
        let index = object.get("index").and_then(Value::as_u64).ok_or_else(|| {
            event_error(
                event,
                "OpenAI-compatible tool call is missing required index",
                Some(tool),
            )
        })? as usize;
        let key = ToolKey::OpenAi(index);
        let function = object.get("function").and_then(Value::as_object);
        accumulator.start_tool(
            key.clone(),
            object.get("id").and_then(Value::as_str),
            None,
            object.get("type").and_then(Value::as_str),
        );
        if let Some(function) = function {
            if let Some(name) = function.get("name").and_then(Value::as_str) {
                accumulator.tool_name(&key, name)?;
            }
            if let Some(arguments) = function.get("arguments").and_then(Value::as_str) {
                accumulator.tool_arguments(&key, arguments)?;
            }
        }

        let extras = object
            .iter()
            .filter(|(key, _)| !matches!(key.as_str(), "index" | "id" | "type" | "function"))
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
        let function_extras = function
            .into_iter()
            .flatten()
            .filter(|(key, _)| !matches!(key.as_str(), "name" | "arguments"))
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect();
        accumulator.tool_extra(&key, extras, function_extras)?;
    }
    Ok(())
}

fn decode_legacy_function(
    delta: &Map<String, Value>,
    accumulator: &mut Accumulator<'_>,
    event: &SseEvent,
) -> Result<(), String> {
    let Some(function) = delta.get("function_call") else {
        return Ok(());
    };
    let function = function.as_object().ok_or_else(|| {
        event_error(
            event,
            "OpenAI-compatible function_call is not an object",
            None,
        )
    })?;
    let key = ToolKey::Legacy;
    accumulator.start_tool(key.clone(), None, None, Some("function"));
    if let Some(name) = function.get("name").and_then(Value::as_str) {
        accumulator.tool_name(&key, name)?;
    }
    if let Some(arguments) = function.get("arguments").and_then(Value::as_str) {
        accumulator.tool_arguments(&key, arguments)?;
    }
    let extras = function
        .iter()
        .filter(|(key, _)| !matches!(key.as_str(), "name" | "arguments"))
        .map(|(key, value)| (key.clone(), value.clone()))
        .collect();
    accumulator.tool_extra(&key, Map::new(), extras)
}

fn parse_usage(value: &Value) -> TokenUsage {
    let prompt = value
        .get("prompt_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    let completion = value
        .get("completion_tokens")
        .and_then(Value::as_u64)
        .unwrap_or(0) as usize;
    TokenUsage {
        prompt_tokens: prompt,
        completion_tokens: completion,
        total_tokens: value
            .get("total_tokens")
            .and_then(Value::as_u64)
            .map(|value| value as usize)
            .unwrap_or(prompt + completion),
        cache_creation_input_tokens: value
            .get("cache_creation_input_tokens")
            .and_then(Value::as_u64)
            .map(|value| value as usize),
        cache_read_input_tokens: value
            .get("cache_read_input_tokens")
            .and_then(Value::as_u64)
            .or_else(|| {
                value
                    .get("prompt_tokens_details")
                    .and_then(|details| details.get("cached_tokens"))
                    .and_then(Value::as_u64)
            })
            .map(|value| value as usize),
    }
}

fn event_error(event: &SseEvent, message: &str, value: Option<&Value>) -> String {
    let payload = value.map(compact).unwrap_or_else(|| snippet(&event.data));
    format!(
        "{message}; event={}, payload={payload}",
        event.event.as_deref().unwrap_or("message")
    )
}

fn compact(value: &Value) -> String {
    snippet(&value.to_string())
}

fn snippet(payload: &str) -> String {
    const LIMIT: usize = 256;
    let end = payload
        .char_indices()
        .map(|(index, _)| index)
        .take_while(|index| *index <= LIMIT)
        .last()
        .unwrap_or(0);
    if payload.len() > LIMIT {
        format!("{}...", &payload[..end])
    } else {
        payload.to_string()
    }
}
