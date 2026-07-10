use crate::agent::Agent;
use crate::chat::ChatMessage;
use crate::snapshot::{FileSnapshot, RollbackPreview, SnapshotEntry, UndoState};

impl Agent {
    pub fn prepare_revert(&self, index: usize) -> RollbackPreview {
        let files_changed: Vec<FileSnapshot> = self
            .file_snapshots
            .iter()
            .filter(|s| s.message_index > index)
            .map(|s| s.snapshot.clone())
            .collect();
        let messages_removed = if index < self.messages.len() {
            self.messages.len() - index - 1
        } else {
            0
        };
        RollbackPreview {
            files_changed,
            messages_removed,
        }
    }

    pub fn instant_revert(&mut self, index: usize) -> Result<RollbackPreview, String> {
        if index >= self.messages.len() {
            return Ok(RollbackPreview {
                files_changed: Vec::new(),
                messages_removed: 0,
            });
        }

        let affected_snaps: Vec<SnapshotEntry> = self
            .file_snapshots
            .iter()
            .filter(|s| s.message_index > index)
            .cloned()
            .collect();

        let file_current: Vec<FileSnapshot> = affected_snaps
            .iter()
            .map(|entry| FileSnapshot {
                path: entry.snapshot.path.clone(),
                content: std::fs::read_to_string(&entry.snapshot.path).ok(),
            })
            .collect();

        let removed_messages: Vec<ChatMessage> = self.messages.drain(index + 1..).collect();
        let messages_removed = removed_messages.len();
        self.file_snapshots.retain(|s| s.message_index <= index);

        self.undo_state = Some(UndoState {
            file_current,
            removed_messages,
            removed_snapshots: affected_snaps.clone(),
        });

        let mut files_changed: Vec<FileSnapshot> = Vec::new();
        for entry in affected_snaps.iter().rev() {
            let path = &entry.snapshot.path;
            files_changed.push(FileSnapshot {
                path: path.clone(),
                content: std::fs::read_to_string(path).ok(),
            });
            match &entry.snapshot.content {
                Some(content) => {
                    if let Some(parent) = std::path::Path::new(path).parent() {
                        std::fs::create_dir_all(parent)
                            .map_err(|e| format!("Failed to create dir for restore {}: {e}", path))?;
                    }
                    std::fs::write(path, content)
                        .map_err(|e| format!("Failed to restore file {}: {e}", path))?;
                }
                None => {
                    std::fs::remove_file(path).ok();
                }
            }
        }

        Ok(RollbackPreview {
            files_changed,
            messages_removed,
        })
    }

    pub fn undo_revert(&mut self) -> Result<(), String> {
        let state = self
            .undo_state
            .take()
            .ok_or_else(|| "No rollback state to undo".to_string())?;

        for snap in &state.file_current {
            match &snap.content {
                Some(content) => {
                    std::fs::write(&snap.path, content)
                        .map_err(|e| format!("Failed to undo restore of file {}: {e}", snap.path))?;
                }
                None => {
                    std::fs::remove_file(&snap.path).ok();
                }
            }
        }

        self.messages.extend(state.removed_messages);
        self.file_snapshots.extend(state.removed_snapshots);
        self.file_snapshots.sort_by_key(|s| s.message_index);

        Ok(())
    }
}
