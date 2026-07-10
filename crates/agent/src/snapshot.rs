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
    pub snapshot: FileSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackPreview {
    pub files_changed: Vec<FileSnapshot>,
    pub messages_removed: usize,
}

#[derive(Debug, Clone)]
pub struct UndoState {
    pub file_current: Vec<FileSnapshot>,
    pub removed_messages: Vec<crate::chat::ChatMessage>,
    pub removed_snapshots: Vec<SnapshotEntry>,
}
