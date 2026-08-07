use serde::{Deserialize, Serialize};

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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_name: Option<String>,
    /// Provider-reported token usage for the turn that produced this message
    /// (assistant messages only). Includes Anthropic prompt-cache metrics.
    /// Never serialized into outbound API requests (`messages_to_api_json`
    /// builds request JSON field-by-field and ignores this field).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<TokenUsage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub function: ToolCallFunction,
    #[serde(flatten, default, skip_serializing_if = "serde_json::Map::is_empty")]
    pub extra_fields: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
    #[serde(flatten, default, skip_serializing_if = "serde_json::Map::is_empty")]
    pub extra_fields: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsage {
    pub prompt_tokens: usize,
    pub completion_tokens: usize,
    pub total_tokens: usize,
    /// Anthropic prompt caching: tokens written to the cache this turn
    /// (billed at 1.25x input price). `None` for providers without caching.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_creation_input_tokens: Option<usize>,
    /// Anthropic prompt caching: tokens served from the cache this turn
    /// (billed at 0.1x input price). Also populated from the OpenAI-compat
    /// `prompt_tokens_details.cached_tokens` field when present.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_read_input_tokens: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AssistantTurn {
    pub content: String,
    pub tool_calls: Vec<ToolCall>,
    pub reasoning_content: Option<String>,
    pub reasoning_name: Option<String>,
    pub usage: Option<TokenUsage>,
    /// Provider-reported finish reason ("stop", "length", "tool_calls", ...).
    /// "length" means the output was cut by the max-tokens limit — the turn
    /// is incomplete and must not be treated as a finished answer.
    pub finish_reason: Option<String>,
}
