use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSnapshot {
    pub path: String,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub message_index: usize,
    pub tool_call_id: String,
    pub snapshot: FileSnapshot,
    pub after_content: Option<String>,
    pub status: AgentChangeStatus,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentChangeStatus {
    Pending,
    Accepted,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentFileChange {
    pub tool_call_id: String,
    pub path: String,
    pub before_content: Option<String>,
    pub after_content: Option<String>,
    pub status: AgentChangeStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackPreview {
    pub files_changed: Vec<FileSnapshot>,
    pub messages_removed: usize,
}
