use std::collections::HashSet;
use std::sync::atomic::AtomicU64;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use crate::chat::ChatMessage;
use crate::config::AgentConfig;
use crate::prompt::system_prompt;
use crate::snapshot::{SnapshotEntry, UndoState};

pub struct Agent {
    pub messages: Vec<ChatMessage>,
    config: AgentConfig,
    always_allow: HashSet<String>,
    pub cancel: Arc<AtomicBool>,
    pub file_snapshots: Vec<SnapshotEntry>,
    pub undo_state: Option<UndoState>,
    todo_context: Option<String>,
    pub last_prompt_tokens: Option<usize>,
    /// Anthropic prompt caching: tokens written to the cache on the last turn.
    pub last_cache_creation_tokens: Option<usize>,
    /// Anthropic prompt caching: tokens read from the cache on the last turn.
    pub last_cache_read_tokens: Option<usize>,
}

static SESSION_KEY_COUNTER: AtomicU64 = AtomicU64::new(0);

fn new_prompt_cache_key() -> String {
    let epoch_nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let sequence = SESSION_KEY_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("openvibe-{epoch_nanos:x}-{sequence:x}")
}

impl Agent {
    pub fn new(mut config: AgentConfig) -> Self {
        config.prompt_cache_key = Some(new_prompt_cache_key());
        let system = system_prompt(&config.cwd);
        Self {
            messages: vec![ChatMessage {
                role: "system".to_string(),
                content: Some(serde_json::Value::String(system)),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
                usage: None,
            }],
            config,
            always_allow: HashSet::new(),
            cancel: Arc::new(AtomicBool::new(false)),
            file_snapshots: Vec::new(),
            undo_state: None,
            todo_context: None,
            last_prompt_tokens: None,
            last_cache_creation_tokens: None,
            last_cache_read_tokens: None,
        }
    }

    /// Rebuild the system prompt, preserving the todo context.
    pub fn update_system_prompt(&mut self) {
        let mut system = crate::prompt::system_prompt(&self.config.cwd);
        if let Some(todo) = &self.todo_context {
            system.push_str("\n\nCURRENT TODO CONTROL STATE (user-managed; follow it):\n");
            system.push_str(todo);
        }
        if !self.messages.is_empty() && self.messages[0].role == "system" {
            self.messages[0].content = Some(serde_json::Value::String(system));
        } else {
            self.messages.insert(
                0,
                ChatMessage {
                    role: "system".to_string(),
                    content: Some(serde_json::Value::String(system)),
                    name: None,
                    tool_call_id: None,
                    tool_calls: None,
                    reasoning_content: None,
                    reasoning_name: None,
                    usage: None,
                },
            );
        }
    }

    pub fn set_todo_context(&mut self, context: Option<String>) {
        if self.todo_context == context {
            return; // idempotent: keep the system prompt byte-identical for prompt caches
        }
        self.todo_context = context;
        self.update_system_prompt();
    }

    pub fn reset(&mut self) {
        crate::project_tree::invalidate_cache(None);
        let system = system_prompt(&self.config.cwd);
        self.messages = vec![ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }];
        self.always_allow.clear();
        self.cancel.store(false, Ordering::Relaxed);
        self.file_snapshots.clear();
        self.undo_state = None;
        self.todo_context = None;
        self.config.prompt_cache_key = Some(new_prompt_cache_key());
        self.last_prompt_tokens = None;
        self.last_cache_creation_tokens = None;
        self.last_cache_read_tokens = None;
    }

    pub fn set_cwd(&mut self, cwd: String) {
        crate::project_tree::invalidate_cache(Some(&self.config.cwd));
        self.config.cwd = cwd;
        let system = system_prompt(&self.config.cwd);
        self.messages = vec![ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }];
        self.always_allow.clear();
        self.cancel.store(false, Ordering::Relaxed);
        self.file_snapshots.clear();
        self.undo_state = None;
        self.todo_context = None;
        self.config.prompt_cache_key = Some(new_prompt_cache_key());
        self.last_prompt_tokens = None;
        self.last_cache_creation_tokens = None;
        self.last_cache_read_tokens = None;
    }

    pub fn set_messages(&mut self, msgs: Vec<ChatMessage>) {
        if msgs.is_empty() {
            return self.reset();
        }
        let system = system_prompt(&self.config.cwd);
        let has_system = msgs.first().map(|m| m.role.as_str()) == Some("system");
        let rest = if has_system { &msgs[1..] } else { &msgs[..] };
        let mut new_msgs = vec![ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        }];
        new_msgs.extend_from_slice(rest);
        self.messages = new_msgs;
    }

    pub fn set_chat_state(&mut self, msgs: Vec<ChatMessage>, file_snapshots: Vec<SnapshotEntry>) {
        self.set_messages(msgs);
        self.file_snapshots = file_snapshots;
        self.undo_state = None;
    }

    pub fn get_messages(&self) -> &[ChatMessage] {
        &self.messages
    }

    pub fn stop(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }

    pub fn config(&self) -> &AgentConfig {
        &self.config
    }

    pub fn config_mut(&mut self) -> &mut AgentConfig {
        &mut self.config
    }

    pub fn always_allow(&self) -> &HashSet<String> {
        &self.always_allow
    }

    pub fn always_allow_mut(&mut self) -> &mut HashSet<String> {
        &mut self.always_allow
    }
}
