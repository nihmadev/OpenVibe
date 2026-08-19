use agent_api::{ChatMessage, FileSnapshot, SnapshotEntry};

#[derive(Debug, Clone)]
pub struct UndoState {
    pub file_current: Vec<FileSnapshot>,
    pub removed_messages: Vec<ChatMessage>,
    pub removed_snapshots: Vec<SnapshotEntry>,
}
