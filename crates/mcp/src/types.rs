use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type", content = "message", rename_all = "camelCase")]
pub enum McpStatus {
    Running,
    Stopped,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct McpServerStatus {
    pub name: String,
    pub status: McpStatus,
    pub enabled: bool,
    pub error: Option<String>,
}
