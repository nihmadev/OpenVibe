use crate::agent::Agent;
use crate::chat::ChatMessage;
use crate::snapshot::{
    AgentChangeStatus, AgentFileChange, FileSnapshot, RollbackPreview, SnapshotEntry, UndoState,
};

impl Agent {
    pub fn get_file_change(&self, tool_call_id: &str) -> Result<AgentFileChange, String> {
        let entry = self
            .file_snapshots
            .iter()
            .find(|entry| entry.tool_call_id == tool_call_id)
            .ok_or_else(|| "This file change is no longer available".to_string())?;

        Ok(AgentFileChange {
            tool_call_id: entry.tool_call_id.clone(),
            path: entry.snapshot.path.clone(),
            before_content: entry.snapshot.content.clone(),
            after_content: entry.after_content.clone(),
            status: entry.status,
        })
    }

    pub fn accept_file_change(&mut self, tool_call_id: &str) -> Result<AgentFileChange, String> {
        let entry = self
            .file_snapshots
            .iter_mut()
            .find(|entry| entry.tool_call_id == tool_call_id)
            .ok_or_else(|| "This file change is no longer available".to_string())?;
        if entry.status == AgentChangeStatus::Rejected {
            return Err("This file change was already rejected".to_string());
        }
        entry.status = AgentChangeStatus::Accepted;
        self.get_file_change(tool_call_id)
    }

    pub fn reject_file_change(&mut self, tool_call_id: &str) -> Result<AgentFileChange, String> {
        let index = self
            .file_snapshots
            .iter()
            .position(|entry| entry.tool_call_id == tool_call_id)
            .ok_or_else(|| "This file change is no longer available".to_string())?;
        let entry = &self.file_snapshots[index];
        if entry.status == AgentChangeStatus::Rejected {
            return self.get_file_change(tool_call_id);
        }

        let current = std::fs::read_to_string(&entry.snapshot.path).ok();
        if current != entry.after_content {
            return Err(
                "The file has changed since this edit. Review or reject the newer changes first."
                    .to_string(),
            );
        }

        match &entry.snapshot.content {
            Some(content) => {
                if let Some(parent) = std::path::Path::new(&entry.snapshot.path).parent() {
                    std::fs::create_dir_all(parent).map_err(|e| {
                        format!(
                            "Failed to create dir for restore {}: {e}",
                            entry.snapshot.path
                        )
                    })?;
                }
                std::fs::write(&entry.snapshot.path, content)
                    .map_err(|e| format!("Failed to restore file {}: {e}", entry.snapshot.path))?;
            }
            None => {
                if let Err(error) = std::fs::remove_file(&entry.snapshot.path) {
                    if error.kind() != std::io::ErrorKind::NotFound {
                        return Err(format!(
                            "Failed to remove file {}: {error}",
                            entry.snapshot.path
                        ));
                    }
                }
            }
        }

        self.file_snapshots[index].status = AgentChangeStatus::Rejected;
        self.get_file_change(tool_call_id)
    }

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
                        std::fs::create_dir_all(parent).map_err(|e| {
                            format!("Failed to create dir for restore {}: {e}", path)
                        })?;
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
                    std::fs::write(&snap.path, content).map_err(|e| {
                        format!("Failed to undo restore of file {}: {e}", snap.path)
                    })?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::AgentConfig;

    fn test_agent() -> Agent {
        Agent::new(AgentConfig {
            api_key: String::new(),
            base_url: String::new(),
            model: String::new(),
            cwd: String::new(),
            api_url: None,
            provider_id: None,
            reasoning_effort: None,
        })
    }

    #[test]
    fn reject_restores_existing_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("changed.txt");
        std::fs::write(&path, "after").unwrap();
        let path = path.to_string_lossy().to_string();
        let mut agent = test_agent();
        agent.file_snapshots.push(SnapshotEntry {
            message_index: 1,
            tool_call_id: "call-1".to_string(),
            snapshot: FileSnapshot {
                path: path.clone(),
                content: Some("before".to_string()),
            },
            after_content: Some("after".to_string()),
            status: AgentChangeStatus::Pending,
        });

        let change = agent.reject_file_change("call-1").unwrap();

        assert_eq!(std::fs::read_to_string(path).unwrap(), "before");
        assert_eq!(change.status, AgentChangeStatus::Rejected);
    }

    #[test]
    fn reject_removes_created_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("created.txt");
        std::fs::write(&path, "created").unwrap();
        let path = path.to_string_lossy().to_string();
        let mut agent = test_agent();
        agent.file_snapshots.push(SnapshotEntry {
            message_index: 1,
            tool_call_id: "call-2".to_string(),
            snapshot: FileSnapshot {
                path: path.clone(),
                content: None,
            },
            after_content: Some("created".to_string()),
            status: AgentChangeStatus::Pending,
        });

        agent.reject_file_change("call-2").unwrap();

        assert!(!std::path::Path::new(&path).exists());
    }

    #[test]
    fn reject_refuses_to_overwrite_newer_content() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("changed-again.txt");
        std::fs::write(&path, "newer").unwrap();
        let path = path.to_string_lossy().to_string();
        let mut agent = test_agent();
        agent.file_snapshots.push(SnapshotEntry {
            message_index: 1,
            tool_call_id: "call-3".to_string(),
            snapshot: FileSnapshot {
                path: path.clone(),
                content: Some("before".to_string()),
            },
            after_content: Some("after".to_string()),
            status: AgentChangeStatus::Pending,
        });

        assert!(agent.reject_file_change("call-3").is_err());
        assert_eq!(std::fs::read_to_string(path).unwrap(), "newer");
    }
}
