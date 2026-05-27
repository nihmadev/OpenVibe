use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

use crate::config::Config;
use crate::llm;

const MAX_TURNS: usize = 25;

// ── Events emitted to frontend ──

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserEvent {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkEvent {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolCallEvent {
    pub id: String,
    pub name: String,
    pub args: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResultEvent {
    pub id: String,
    pub ok: bool,
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDeniedEvent {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmRequestEvent {
    pub id: String,
    pub tool_name: String,
    pub args: serde_json::Value,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ErrorEvent {
    pub text: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BusyEvent {
    pub busy: bool,
}

// ── Helpers for shared mutable state in Fn closures ──

struct SharedBuffer {
    buf: String,
    last_emit: std::time::Instant,
}

// ── System prompt ──

fn system_prompt(cwd: &str) -> String {
    [
        "You are openvibe, a coding assistant with direct access to the file system.",
        &format!("CURRENT WORKING DIRECTORY: {}", cwd),
        "",
        "CORE PHILOSOPHY:",
        "- Use tools ONLY when necessary (reading/writing files, running commands).",
        "- For greetings, explanations, architecture questions, or general conversation — respond with normal text.",
        "- Be helpful, concise, and professional.",
        "",
        "HARD RULES (никогда не нарушай):",
        "1. NEVER output full source code in chat. The user sees the file in the editor.",
        "2. To create a new file → use write_file tool.",
        "3. To modify an existing file → ALWAYS use edit_file tool. Never use write_file on existing files.",
        "4. After creating or editing a file, give a short confirmation (1-2 sentences max) + suggested run command if applicable.",
        "5. If the change is complex, you may add a brief explanation of what was changed.",
        "",
        "SAFETY RULES:",
        "- Never execute dangerous or destructive commands (rm -rf, format, mkfs, dd, etc.) without explicit user confirmation.",
        "- If user asks for something potentially dangerous — always double-check and warn.",
        "",
        "TOOL PRIORITIES:",
        "- search_codebase — first choice when user says 'find', 'where', 'search', 'how is implemented', etc.",
        "- read_file / list_dir — for exploring structure and reading known files.",
        "- Never use list_dir to find specific logic — use search_codebase instead.",
        "",
        "LANGUAGE:",
        "- If user writes in Russian → respond in Russian.",
        "- If user writes in English → respond in English.",
        "",
        "TOOL USAGE EXAMPLES:",
        "- User: 'Hi!' → 'Привет! Чем могу помочь?'",
        "- User: 'Explain React' → normal explanation (no tools)",
        "- User: 'Create a hello world in python' → write_file tool",
        "- User: 'Update the title in index.html' → edit_file tool",
        "- User: 'Run my tests' → bash tool",
        "- User: 'Where is the authentication logic?' → search_codebase tool",
        "",
        "Behavior:",
        "- Be concise but friendly.",
        "- If you see opportunities for improvement — you can suggest them naturally.",
        "- If a tool returns an error — explain it clearly and offer solutions.",
        "- Do not be overly robotic. Natural responses are preferred.",
        "",
        "For math: use LaTeX format (\\( \\) inline, \\[ \\] block).",
    ]
    .join("\n")
}

// ── Tool definitions (mirrors src/tools.ts) ──

fn read_file_tool() -> llm::ToolDefinition {
    llm::ToolDefinition {
        type_: "function".to_string(),
        function: llm::ToolDefFunction {
            name: "read_file".to_string(),
            description: "Read a UTF-8 text file from the local filesystem. Use this to see file contents, configuration, or source code.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file"
                    }
                },
                "required": ["path"]
            }),
        },
    }
}

fn write_file_tool() -> llm::ToolDefinition {
    llm::ToolDefinition {
        type_: "function".to_string(),
        function: llm::ToolDefFunction {
            name: "write_file".to_string(),
            description: "Create a new file with the given content. NEVER use this on files that already exist - use edit_file instead.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path where the file should be created"
                    },
                    "content": {
                        "type": "string",
                        "description": "Full file content"
                    }
                },
                "required": ["path", "content"]
            }),
        },
    }
}

fn edit_file_tool() -> llm::ToolDefinition {
    llm::ToolDefinition {
        type_: "function".to_string(),
        function: llm::ToolDefFunction {
            name: "edit_file".to_string(),
            description: "Find an exact string in a file and replace it with a new string. Always use this for modifying existing files - NEVER use write_file on files that exist.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the file"
                    },
                    "old_str": {
                        "type": "string",
                        "description": "The exact existing string to replace (must match exactly)"
                    },
                    "new_str": {
                        "type": "string",
                        "description": "The new string to replace with"
                    }
                },
                "required": ["path", "old_str", "new_str"]
            }),
        },
    }
}

fn list_dir_tool() -> llm::ToolDefinition {
    llm::ToolDefinition {
        type_: "function".to_string(),
        function: llm::ToolDefFunction {
            name: "list_dir".to_string(),
            description: "List all files and directories in a given directory. Use this to explore the project structure.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute or relative path to the directory"
                    }
                },
                "required": ["path"]
            }),
        },
    }
}

fn bash_tool() -> llm::ToolDefinition {
    llm::ToolDefinition {
        type_: "function".to_string(),
        function: llm::ToolDefFunction {
            name: "bash".to_string(),
            description: "Run a shell command in the project directory. Returns stdout + stderr. Use this for running tests, builds, or any CLI commands.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    },
                    "timeout": {
                        "type": "number",
                        "description": "Optional timeout in milliseconds (default 30000)"
                    }
                },
                "required": ["command"]
            }),
        },
    }
}

fn search_codebase_tool() -> llm::ToolDefinition {
    llm::ToolDefinition {
        type_: "function".to_string(),
        function: llm::ToolDefFunction {
            name: "search_codebase".to_string(),
            description: "Search the entire codebase for specific content, logic, or answers. This is the PRIMARY tool for finding WHERE something is implemented or searching for text. Use this for both regex patterns and natural language questions.".to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Filename or path pattern to search for"
                    }
                },
                "required": ["query"]
            }),
        },
    }
}

fn build_tool_definitions() -> Vec<llm::ToolDefinition> {
    vec![
        read_file_tool(),
        write_file_tool(),
        edit_file_tool(),
        list_dir_tool(),
        bash_tool(),
        search_codebase_tool(),
    ]
}

fn requires_confirmation(name: &str) -> bool {
    matches!(name, "bash")
}

// ── Tool implementations ──

fn tool_read_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let resolved = if std::path::Path::new(path).is_absolute() {
        path.to_string()
    } else {
        std::path::Path::new(cwd)
            .join(path)
            .to_string_lossy()
            .to_string()
    };
    std::fs::read_to_string(&resolved).map_err(|e| format!("Failed to read file: {e}"))
}

fn tool_write_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let content = args
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'content' argument".to_string())?;
    let resolved = if std::path::Path::new(path).is_absolute() {
        path.to_string()
    } else {
        std::path::Path::new(cwd)
            .join(path)
            .to_string_lossy()
            .to_string()
    };
    if let Some(parent) = std::path::Path::new(&resolved).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {e}"))?;
    }
    std::fs::write(&resolved, content).map_err(|e| format!("Failed to write file: {e}"))?;
    let display = std::path::Path::new(&resolved)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| resolved.clone());
    Ok(format!("Created {display}"))
}

fn tool_edit_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let old_str = args
        .get("old_str")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'old_str' argument".to_string())?;
    let new_str = args
        .get("new_str")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'new_str' argument".to_string())?;
    let resolved = if std::path::Path::new(path).is_absolute() {
        path.to_string()
    } else {
        std::path::Path::new(cwd)
            .join(path)
            .to_string_lossy()
            .to_string()
    };
    let content = std::fs::read_to_string(&resolved)
        .map_err(|e| format!("Failed to read file: {e}"))?;
    if !content.contains(old_str) {
        return Err(format!("Could not find exact match for old_str in {resolved}"));
    }
    let new_content = content.replacen(old_str, new_str, 1);
    std::fs::write(&resolved, &new_content).map_err(|e| format!("Failed to write file: {e}"))?;
    let display = std::path::Path::new(&resolved)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| resolved.clone());
    Ok(format!("Updated {display}"))
}

fn tool_list_dir(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let resolved = if std::path::Path::new(path).is_absolute() {
        path.to_string()
    } else {
        std::path::Path::new(cwd)
            .join(path)
            .to_string_lossy()
            .to_string()
    };
    let entries =
        std::fs::read_dir(&resolved).map_err(|e| format!("Failed to list directory: {e}"))?;
    let mut names: Vec<String> = entries
        .filter_map(|e| e.ok())
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            if e.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                format!("{name}/")
            } else {
                name
            }
        })
        .collect();
    names.sort_by(|a, b| {
        let a_dir = a.ends_with('/');
        let b_dir = b.ends_with('/');
        if a_dir != b_dir {
            return if a_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.to_lowercase().cmp(&b.to_lowercase())
    });
    Ok(names.join("\n"))
}

fn tool_bash(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let command = args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'command' argument".to_string())?;

    let shell = if cfg!(target_os = "windows") {
        "cmd.exe"
    } else {
        "sh"
    };
    let flag = if cfg!(target_os = "windows") {
        "/C"
    } else {
        "-c"
    };

    let output = std::process::Command::new(shell)
        .arg(flag)
        .arg(command)
        .current_dir(cwd)
        .output()
        .map_err(|e| format!("Failed to run command: {e}"))?;

    let mut result = String::new();
    if !output.stdout.is_empty() {
        result.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        if !result.is_empty() {
            result.push('\n');
        }
        result.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    if !output.status.success() {
        let exit_code = output.status.code().unwrap_or(-1);
        result.push_str(&format!("\n[exit code: {exit_code}]"));
    }
    Ok(result)
}

fn tool_search_codebase(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'query' argument".to_string())?;
    let root = if cwd.is_empty() { "." } else { cwd };

    let is_regex_query = regex::Regex::new(&format!("(?i){}", query)).is_ok();
    let use_regex = regex::Regex::new(&format!("(?i){}", query)).ok();
    let query_lower = query.to_lowercase();

    let skip: &[&str] = &[
        "node_modules", ".git", "dist", "build", ".next", "out",
    ];

    let mut results: Vec<String> = Vec::new();
    let mut dirs: Vec<std::path::PathBuf> = vec![std::path::PathBuf::from(root)];

    while let Some(dir) = dirs.pop() {
        if results.len() >= 30 {
            break;
        }
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if results.len() >= 30 {
                break;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if skip.iter().any(|s| s == &name) {
                continue;
            }
            if let Ok(ft) = entry.file_type() {
                if ft.is_dir() {
                    dirs.push(entry.path());
                } else if ft.is_file() {
                    if let Ok(meta) = entry.metadata() {
                        if meta.len() > 256 * 1024 {
                            continue;
                        }
                    }
                    let path = entry.path();
                    let text = match std::fs::read_to_string(&path) {
                        Ok(t) => t,
                        Err(_) => continue,
                    };
                    let path_str = path.to_string_lossy().to_string();
                    for (i, line) in text.lines().enumerate() {
                        if results.len() >= 30 {
                            break;
                        }
                        let matched = if let Some(ref re) = use_regex {
                            re.is_match(line)
                        } else {
                            line.to_lowercase().contains(&query_lower)
                        };
                        if matched {
                            results.push(format!("{}:{}: {}", path_str, i + 1, line));
                        }
                    }
                }
            }
        }
    }

    // If regex found results or query looks like regex, return regex results
    if !results.is_empty() || is_regex_query {
        if results.is_empty() {
            return Ok(format!("No results found for '{query}'"));
        }
        return Ok(results.join("\n"));
    }

    // Supplement with vector search for semantic understanding
    if let Ok(vec_results) = crate::vector_search::search_codebase_vector(query, root, 30) {
        for r in vec_results {
            results.push(format!("{}:{}: {} [score={:.3}]", r.path, r.line, r.content, r.score));
        }
    }

    if results.is_empty() {
        Ok(format!("No results found for '{query}'"))
    } else {
        Ok(results.join("\n"))
    }
}

// ── Agent ──

pub struct Agent {
    pub messages: Vec<llm::ChatMessage>,
    config: Config,
    always_allow: HashSet<String>,
    pub cancel: Arc<AtomicBool>,
}

impl Agent {
    pub fn new(config: Config) -> Self {
        let system = system_prompt(&config.cwd);
        Self {
            messages: vec![llm::ChatMessage {
                role: "system".to_string(),
                content: Some(serde_json::Value::String(system)),
                name: None,
                tool_call_id: None,
                tool_calls: None,
                reasoning_content: None,
            }],
            config,
            always_allow: HashSet::new(),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn reset(&mut self) {
        let system = system_prompt(&self.config.cwd);
        self.messages = vec![llm::ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
        }];
        self.always_allow.clear();
        self.cancel.store(false, Ordering::Relaxed);
    }

    pub fn set_cwd(&mut self, cwd: String) {
        self.config.cwd = cwd;
        let system = system_prompt(&self.config.cwd);
        self.messages = vec![llm::ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
        }];
        self.always_allow.clear();
        self.cancel.store(false, Ordering::Relaxed);
    }

    pub fn set_messages(&mut self, msgs: Vec<llm::ChatMessage>) {
        if msgs.is_empty() {
            self.reset();
            return;
        }
        let system = system_prompt(&self.config.cwd);
        let has_system = msgs.first().map(|m| m.role.as_str()) == Some("system");
        let rest = if has_system { &msgs[1..] } else { &msgs[..] };
        let mut new_msgs = vec![llm::ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
        }];
        new_msgs.extend_from_slice(rest);
        self.messages = new_msgs;
    }

    pub fn get_messages(&self) -> &[llm::ChatMessage] {
        &self.messages
    }

    pub fn revert_to(&mut self, index: usize) {
        if index < self.messages.len() {
            self.messages.truncate(index + 1);
        }
    }

    pub fn stop(&self) {
        self.cancel.store(true, Ordering::Relaxed);
    }

    pub fn get_config(&self) -> &Config {
        &self.config
    }

    pub fn get_config_mut(&mut self) -> &mut Config {
        &mut self.config
    }

    pub async fn summarize_with(
        config: Config,
        messages: Vec<llm::ChatMessage>,
        client: &reqwest::Client,
    ) -> String {
        if messages.len() < 2 {
            return "New chat".to_string();
        }

        let context_messages: Vec<llm::ChatMessage> = if messages.len() > 10 {
            let mut msgs = vec![messages[0].clone()];
            let start = messages.len().saturating_sub(5);
            msgs.extend_from_slice(&messages[start..]);
            msgs
        } else {
            messages
        };

        let mut prompt = context_messages;
        prompt.push(llm::ChatMessage {
            role: "user".to_string(),
            content: Some(serde_json::Value::String(
                "Provide a very short (max 3-5 words) descriptive title for this conversation. Respond ONLY with the title text. No quotes, no intro like 'Title:', no punctuation at the end.".to_string(),
            )),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
        });

        let cancel = Arc::new(AtomicBool::new(false));
        let title = Arc::new(Mutex::new(String::new()));

        let llm_config = llm::LlmConfig {
            api_key: config.api_key.clone(),
            base_url: config.base_url.clone(),
            model: config.model.clone(),
            api_url: config.api_url.clone(),
            provider_id: config.provider_id.clone(),
        };

        let title_capture = title.clone();
        let result = llm::stream_chat(
            &llm_config,
            prompt,
            vec![],
            &cancel,
            client,
            &|chunk: &str| {
                if let Ok(mut t) = title_capture.lock() {
                    t.push_str(chunk);
                }
            },
            &|_: &str| {},
            &|| {},
        )
        .await;

        match result {
            Ok(turn) => {
                let mut t = turn.content.trim().to_string();
                let prefixes = [
                    "Title:", "Topic:", "Summary:", "Название:", "Тема:", "Заголовок:",
                    "title:", "topic:", "summary:",
                ];
                for prefix in &prefixes {
                    if let Some(rest) = t.strip_prefix(prefix) {
                        t = rest.trim().to_string();
                        break;
                    }
                }
                if (t.starts_with('"') && t.ends_with('"'))
                    || (t.starts_with('\'') && t.ends_with('\''))
                {
                    t = t[1..t.len().saturating_sub(1)].to_string();
                }
                while t.ends_with('.') || t.ends_with('!') || t.ends_with('?') {
                    t.truncate(t.len().saturating_sub(1));
                }
                let t = t.trim().to_string();
                if t.is_empty() || t.len() > 60 {
                    return "New chat".to_string();
                }
                t
            }
            Err(_) => "New chat".to_string(),
        }
    }

    pub async fn summarize(&self, client: &reqwest::Client) -> String {
        Self::summarize_with(self.config.clone(), self.messages.clone(), client).await
    }

    pub async fn send(
        &mut self,
        input: String,
        content_parts: Option<Vec<serde_json::Value>>,
        app: &AppHandle,
        confirm_senders: &mut HashMap<String, oneshot::Sender<String>>,
        client: &reqwest::Client,
    ) {
        // Determine content and display text
        let content: serde_json::Value;
        let display: String;

        if let Some(parts) = content_parts {
            display = parts
                .iter()
                .filter_map(|p| {
                    if p.get("type").and_then(|v| v.as_str()) == Some("text") {
                        p.get("text").and_then(|v| v.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            if parts.len() == 1
                && parts[0].get("type").and_then(|v| v.as_str()) == Some("text")
            {
                if let Some(text) = parts[0].get("text").and_then(|v| v.as_str()) {
                    content = serde_json::Value::String(text.to_string());
                } else {
                    content = serde_json::Value::Array(parts);
                }
            } else {
                content = serde_json::Value::Array(parts);
            }
        } else {
            display = input.clone();
            content = serde_json::Value::String(input.clone());
        }

        // Check if provider is connected
        if self.config.api_key.is_empty() {
            let _ = app.emit(
                "vibe:agent:error",
                ErrorEvent {
                    text: "API not connected. Open Settings to add a provider.".to_string(),
                },
            );
            return;
        }

        self.messages.push(llm::ChatMessage {
            role: "user".to_string(),
            content: Some(content),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
        });

        let _ = app.emit("vibe:agent:user", UserEvent { text: display });
        let _ = app.emit("vibe:agent:busy", BusyEvent { busy: true });

        let tool_defs = build_tool_definitions();
        let cwd = self.config.cwd.clone();

        let llm_config = llm::LlmConfig {
            api_key: self.config.api_key.clone(),
            base_url: self.config.base_url.clone(),
            model: self.config.model.clone(),
            api_url: self.config.api_url.clone(),
            provider_id: self.config.provider_id.clone(),
        };

        for _turn in 0..MAX_TURNS {
            if self.cancel.load(Ordering::Relaxed) {
                break;
            }

            let _ = app.emit("vibe:agent:assistant-start", ());

            let chunk_buf = Arc::new(Mutex::new(SharedBuffer {
                buf: String::new(),
                last_emit: std::time::Instant::now(),
            }));
            let reason_buf = Arc::new(Mutex::new(SharedBuffer {
                buf: String::new(),
                last_emit: std::time::Instant::now(),
            }));
            let app_for_emit = app.clone();
            let debounce = Duration::from_millis(50);

            let cb_chunk = {
                let chunk_buf = chunk_buf.clone();
                let app_clone = app_for_emit.clone();
                move |chunk: &str| {
                    if let Ok(mut sb) = chunk_buf.lock() {
                        sb.buf.push_str(chunk);
                        let now = std::time::Instant::now();
                        if now.duration_since(sb.last_emit) >= debounce {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = now;
                            drop(sb);
                            let _ = app_clone.emit(
                                "vibe:agent:assistant-chunk",
                                ChunkEvent { text },
                            );
                        }
                    }
                }
            };

            let cb_reasoning = {
                let reason_buf = reason_buf.clone();
                let app_clone = app_for_emit.clone();
                move |chunk: &str| {
                    if let Ok(mut sb) = reason_buf.lock() {
                        sb.buf.push_str(chunk);
                        let now = std::time::Instant::now();
                        if now.duration_since(sb.last_emit) >= debounce {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = now;
                            drop(sb);
                            let _ = app_clone.emit(
                                "vibe:agent:reasoning-chunk",
                                ChunkEvent { text },
                            );
                        }
                    }
                }
            };

            let cb_reasoning_end = {
                let reason_buf = reason_buf.clone();
                let app_clone = app_for_emit.clone();
                move || {
                    if let Ok(mut sb) = reason_buf.lock() {
                        if !sb.buf.is_empty() {
                            let text = std::mem::take(&mut sb.buf);
                            drop(sb);
                            let _ = app_clone.emit(
                                "vibe:agent:reasoning-chunk",
                                ChunkEvent { text },
                            );
                        }
                    }
                    let _ = app_clone.emit("vibe:agent:reasoning-end", ());
                }
            };

            let turn_result = llm::stream_chat(
                &llm_config,
                self.messages.clone(),
                tool_defs.clone(),
                &self.cancel,
                client,
                &cb_chunk,
                &cb_reasoning,
                &cb_reasoning_end,
            )
            .await;

            // Flush remaining buffers
            if let Ok(mut sb) = chunk_buf.lock() {
                if !sb.buf.is_empty() {
                    let text = std::mem::take(&mut sb.buf);
                    drop(sb);
                    let _ = app.emit("vibe:agent:assistant-chunk", ChunkEvent { text });
                }
            }

            let turn_result = match turn_result {
                Ok(r) => r,
                Err(e) => {
                    let is_abort = e == "Aborted";
                    if is_abort {
                        let _ = app.emit("vibe:agent:stopped", ());
                    } else {
                        let _ = app.emit("vibe:agent:error", ErrorEvent { text: e });
                    }
                    break;
                }
            };

            // Clean noise from content
            let mut content_text = turn_result.content.trim().to_string();
            let noise_phrases = [
                "done", "done.", "finished", "finished.", "completed", "completed.",
            ];
            if noise_phrases.contains(&content_text.as_str()) {
                content_text.clear();
            }

            // Clean tool calls: strip "done" keys and filter noise
            let cleaned_tool_calls: Vec<llm::ToolCall> = turn_result
                .tool_calls
                .into_iter()
                .filter_map(|call| {
                    let name = call.function.name.trim().to_string();
                    if name.is_empty() {
                        return None;
                    }
                    let args_str = call.function.arguments.clone();
                    if args_str.trim().is_empty() {
                        return Some(llm::ToolCall {
                            id: call.id,
                            type_: "function".to_string(),
                            function: llm::ToolCallFunction {
                                name,
                                arguments: args_str,
                            },
                        });
                    }
                    match serde_json::from_str::<serde_json::Value>(&args_str) {
                        Ok(mut parsed) if parsed.is_object() => {
                            if let Some(obj) = parsed.as_object_mut() {
                                if obj.contains_key("done") {
                                    obj.remove("done");
                                    if obj.is_empty() {
                                        return None;
                                    }
                                }
                            }
                            let cleaned_args =
                                serde_json::to_string(&parsed).unwrap_or(args_str);
                            Some(llm::ToolCall {
                                id: call.id,
                                type_: "function".to_string(),
                                function: llm::ToolCallFunction {
                                    name,
                                    arguments: cleaned_args,
                                },
                            })
                        }
                        _ => Some(llm::ToolCall {
                            id: call.id,
                            type_: "function".to_string(),
                            function: llm::ToolCallFunction {
                                name,
                                arguments: args_str,
                            },
                        }),
                    }
                })
                .collect();

            let _ = app.emit("vibe:agent:assistant-end", ());

            self.messages.push(llm::ChatMessage {
                role: "assistant".to_string(),
                content: if content_text.is_empty() {
                    None
                } else {
                    Some(serde_json::Value::String(content_text.clone()))
                },
                name: None,
                tool_call_id: None,
                tool_calls: if cleaned_tool_calls.is_empty() {
                    None
                } else {
                    Some(cleaned_tool_calls.clone())
                },
                reasoning_content: turn_result.reasoning_content.clone(),
            });

            if cleaned_tool_calls.is_empty() {
                if !content_text.is_empty() {
                    let _ = app.emit("vibe:agent:done", ());
                } else if turn_result.content.trim().is_empty() {
                    eprintln!("Model returned no content and no tool calls");
                    let _ = app.emit(
                        "vibe:agent:error",
                        ErrorEvent {
                            text: "Model returned an empty response. This can happen if the prompt was blocked or the model failed to generate a response.".to_string(),
                        },
                    );
                }
                break;
            }

            // Process each tool call
            for call in &cleaned_tool_calls {
                if self.cancel.load(Ordering::Relaxed) {
                    break;
                }

                let tool_name = &call.function.name;
                let args_str = &call.function.arguments;

                let parsed_args: serde_json::Value = if args_str.trim().is_empty() {
                    serde_json::Value::Object(serde_json::Map::new())
                } else {
                    match serde_json::from_str(args_str) {
                        Ok(v) => v,
                        Err(e) => {
                            let err_msg = format!("Invalid JSON arguments: {e}");
                            let _ = app.emit(
                                "vibe:agent:tool-result",
                                ToolResultEvent {
                                    id: call.id.clone(),
                                    ok: false,
                                    text: err_msg.clone(),
                                },
                            );
                            self.messages.push(llm::ChatMessage {
                                role: "tool".to_string(),
                                content: Some(serde_json::Value::String(err_msg)),
                                name: None,
                                tool_call_id: Some(call.id.clone()),
                                tool_calls: None,
                                reasoning_content: None,
                            });
                            continue;
                        }
                    }
                };

                let _ = app.emit(
                    "vibe:agent:tool-call",
                    ToolCallEvent {
                        id: call.id.clone(),
                        name: tool_name.clone(),
                        args: parsed_args.clone(),
                    },
                );

                tokio::time::sleep(Duration::from_millis(800)).await;

                let needs_confirm = requires_confirmation(tool_name)
                    && !self.config.auto_approve
                    && !self.always_allow.contains(tool_name);

                if needs_confirm {
                    let confirm_id = uuid::Uuid::new_v4().to_string();
                    let (tx, mut rx) = oneshot::channel::<String>();
                    confirm_senders.insert(confirm_id.clone(), tx);

                    let _ = app.emit(
                        "vibe:agent:confirm-request",
                        ConfirmRequestEvent {
                            id: confirm_id.clone(),
                            tool_name: tool_name.clone(),
                            args: parsed_args.clone(),
                        },
                    );

                    let decision =
                        match tokio::time::timeout(Duration::from_secs(300), &mut rx).await
                        {
                            Ok(Ok(d)) => d,
                            _ => "no".to_string(),
                        };
                    confirm_senders.remove(&confirm_id);

                    if decision == "no" {
                        let _ = app.emit(
                            "vibe:agent:tool-denied",
                            ToolDeniedEvent {
                                id: call.id.clone(),
                                name: tool_name.clone(),
                            },
                        );
                        let denied_msg = "User denied this tool call.".to_string();
                        self.messages.push(llm::ChatMessage {
                            role: "tool".to_string(),
                            content: Some(serde_json::Value::String(denied_msg)),
                            name: None,
                            tool_call_id: Some(call.id.clone()),
                            tool_calls: None,
                            reasoning_content: None,
                        });
                        continue;
                    }
                    if decision == "always" {
                        self.always_allow.insert(tool_name.clone());
                    }
                }

                let result_text = match tool_name.as_str() {
                    "read_file" => tool_read_file(&cwd, &parsed_args),
                    "write_file" => tool_write_file(&cwd, &parsed_args),
                    "edit_file" => tool_edit_file(&cwd, &parsed_args),
                    "list_dir" => tool_list_dir(&cwd, &parsed_args),
                    "bash" => tool_bash(&cwd, &parsed_args),
                    "search_codebase" => tool_search_codebase(&cwd, &parsed_args),
                    _ => Err(format!("Unknown tool: {tool_name}")),
                };

                match &result_text {
                    Ok(text) => {
                        let _ = app.emit(
                            "vibe:agent:tool-result",
                            ToolResultEvent {
                                id: call.id.clone(),
                                ok: true,
                                text: text.clone(),
                            },
                        );
                    }
                    Err(e) => {
                        let _ = app.emit(
                            "vibe:agent:tool-result",
                            ToolResultEvent {
                                id: call.id.clone(),
                                ok: false,
                                text: e.clone(),
                            },
                        );
                    }
                }

                self.messages.push(llm::ChatMessage {
                    role: "tool".to_string(),
                    content: Some(serde_json::Value::String(
                        result_text.unwrap_or_else(|e| e),
                    )),
                    name: None,
                    tool_call_id: Some(call.id.clone()),
                    tool_calls: None,
                    reasoning_content: None,
                });
            }
        }

        let _ = app.emit("vibe:agent:busy", BusyEvent { busy: false });
    }
}
