use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tokio::fs;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::time::timeout;

const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_OUTPUT_CHARS: usize = 16_000;

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        format!(
            "{}\n…[truncated, {} more chars]",
            &text[..max],
            text.len() - max
        )
    }
}

fn resolve_path(cwd: &str, p: &str) -> String {
    let path = Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        Path::new(cwd).join(p).to_string_lossy().to_string()
    }
}

/// Matches the ToolDefinition from TypeScript types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub type_: String,
    pub function: ToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

pub fn build_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            type_: "function".to_string(),
            function: ToolFunction {
                name: "read_file".to_string(),
                description: "Read a UTF-8 text file from the workspace.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Relative or absolute path." }
                    },
                    "required": ["path"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: ToolFunction {
                name: "write_file".to_string(),
                description:
                    "Create or overwrite a file with the given content. Creates parent dirs."
                        .to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "content": { "type": "string" }
                    },
                    "required": ["path", "content"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: ToolFunction {
                name: "edit_file".to_string(),
                description:
                    "Replace the first exact occurrence of old_str with new_str in a file. old_str must be unique."
                        .to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" },
                        "old_str": { "type": "string" },
                        "new_str": { "type": "string" }
                    },
                    "required": ["path", "old_str", "new_str"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: ToolFunction {
                name: "list_dir".to_string(),
                description: "List files and directories in a path (non-recursive). Use this ONLY to see if a file exists or to explore the folder structure. Do NOT use this to find specific logic or content.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Defaults to '.'" }
                    },
                    "required": []
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: ToolFunction {
                name: "bash".to_string(),
                description:
                    "Run a shell command in the workspace. Output (stdout+stderr) is returned."
                        .to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" },
                        "timeout_ms": {
                            "type": "number",
                            "description": "Optional timeout, defaults to 60000."
                        }
                    },
                    "required": ["command"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: ToolFunction {
                name: "search_codebase".to_string(),
                description:
                    "Search the entire codebase for specific content, logic, or answers. This is the PRIMARY tool for finding WHERE something is implemented or searching for text. Use this for both regex patterns and natural language questions."
                        .to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Search query. Can be a regex pattern (e.g. 'function handle.*') or a question (e.g. 'Where is the login logic?')." },
                        "path": { "type": "string", "description": "Directory to search, defaults to '.'" },
                        "max_results": { "type": "number" }
                    },
                    "required": ["query"]
                }),
            },
        },
    ]
}

#[allow(dead_code)]
pub fn requires_confirmation(name: &str) -> bool {
    matches!(name, "bash")
}

pub async fn execute_tool(
    name: &str,
    args: &serde_json::Value,
    cwd: &str,
    cancel: Option<&AtomicBool>,
) -> Result<String, String> {
    match name {
        "read_file" => tool_read_file(cwd, args).await,
        "write_file" => tool_write_file(cwd, args).await,
        "edit_file" => tool_edit_file(cwd, args).await,
        "list_dir" => tool_list_dir(cwd, args).await,
        "bash" => tool_bash(cwd, args, cancel.unwrap_or(&AtomicBool::new(false))).await,
        "search_codebase" => tool_search_codebase(cwd, args).await,
        _ => Err(format!("Unknown tool: {name}")),
    }
}

/// ── Tool implementations ──

async fn tool_read_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let resolved = resolve_path(cwd, path);

    let mut file = fs::File::open(&resolved)
        .await
        .map_err(|e| format!("Failed to open file: {e}"))?;

    let metadata = file
        .metadata()
        .await
        .map_err(|e| format!("Failed to read metadata: {e}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!("File too large ({} bytes)", metadata.len()));
    }

    let mut content = String::new();
    file.read_to_string(&mut content)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;

    Ok(clip(&content, MAX_OUTPUT_CHARS))
}

async fn tool_write_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let content = args
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'content' argument".to_string())?;
    let resolved = resolve_path(cwd, path);

    if let Some(parent) = Path::new(&resolved).parent() {
        fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }
    fs::write(&resolved, content)
        .await
        .map_err(|e| format!("Failed to write file: {e}"))?;

    Ok(format!("Wrote {} chars to {}", content.len(), path))
}

async fn tool_edit_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
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
    let resolved = resolve_path(cwd, path);

    let original = fs::read_to_string(&resolved)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;

    let first = original.find(old_str);
    match first {
        None => return Ok(format!("old_str not found in {path}")),
        Some(pos) => {
            // Check uniqueness: look for a second occurrence after the first
            let rest = &original[pos + old_str.len()..];
            if rest.contains(old_str) {
                return Ok(format!(
                    "old_str is not unique in {path}; provide more context."
                ));
            }
            let updated = format!(
                "{}{}{}",
                &original[..pos],
                new_str,
                &original[pos + old_str.len()..]
            );
            fs::write(&resolved, &updated)
                .await
                .map_err(|e| format!("Failed to write file: {e}"))?;
        }
    }

    Ok(format!("Edited {path}"))
}

async fn tool_list_dir(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");
    let resolved = resolve_path(cwd, path);

    let mut entries = fs::read_dir(&resolved)
        .await
        .map_err(|e| format!("Failed to list directory: {e}"))?;

    let mut names: Vec<String> = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {e}"))?
    {
        let name = entry.file_name().to_string_lossy().to_string();
        if entry
            .file_type()
            .await
            .map(|t| t.is_dir())
            .unwrap_or(false)
        {
            names.push(format!("{name}/"));
        } else {
            names.push(name);
        }
    }

    names.sort();
    if names.is_empty() {
        Ok("(empty)".to_string())
    } else {
        Ok(names.join("\n"))
    }
}

async fn tool_bash(
    cwd: &str,
    args: &serde_json::Value,
    cancel: &AtomicBool,
) -> Result<String, String> {
    let command = args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'command' argument".to_string())?;
    let timeout_ms = args
        .get("timeout_ms")
        .and_then(|v| v.as_u64())
        .unwrap_or(60_000);

    let shell = if cfg!(target_os = "windows") {
        "cmd.exe"
    } else {
        "bash"
    };
    let flag = if cfg!(target_os = "windows") {
        "/C"
    } else {
        "-c"
    };

    let child = Command::new(shell)
        .arg(flag)
        .arg(command)
        .current_dir(cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn: {e}"))?;

    let result = timeout(Duration::from_millis(timeout_ms), child.wait_with_output())
        .await
        .map_err(|_| format!("[killed after {timeout_ms}ms]"))?;

    let output = result.map_err(|e| format!("Process error: {e}"))?;

    if cancel.load(Ordering::Relaxed) {
        return Err("Aborted".to_string());
    }

    let mut out = String::new();
    if !output.stdout.is_empty() {
        out.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(&String::from_utf8_lossy(&output.stderr));
    }
    out.push_str(&format!("\n[exit {}]", output.status.code().unwrap_or(0)));

    Ok(clip(&out, MAX_OUTPUT_CHARS))
}

async fn tool_search_codebase(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'query' argument".to_string())?;
    let root = args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");
    let max = args
        .get("max_results")
        .and_then(|v| v.as_u64())
        .unwrap_or(200) as usize;

    let resolved_root = resolve_path(cwd, root);

    // Try to compile as regex first
    let is_regex_query = regex::Regex::new(&format!("(?i){}", query)).is_ok();

    let skip: &[&str] = &[
        "node_modules", ".git", "dist", "build", ".next", "out",
    ];
    let skip: Vec<String> = skip.iter().map(|s| s.to_string()).collect();

    // Run regex/string search in blocking thread
    let resolved_root_clone = resolved_root.clone();
    let q = query.to_string();
    let skip_clone = skip.clone();
    let regex_results = tokio::task::spawn_blocking(move || -> Vec<String> {
        let mut results: Vec<String> = Vec::new();
        let mut dirs: Vec<std::path::PathBuf> =
            vec![std::path::PathBuf::from(&resolved_root_clone)];

        let use_regex = regex::Regex::new(&format!("(?i){}", q)).ok();
        let q_lower = q.to_lowercase();

        while let Some(dir) = dirs.pop() {
            if results.len() >= max {
                break;
            }
            let entries = match std::fs::read_dir(&dir) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                if results.len() >= max {
                    break;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                if skip_clone.iter().any(|s| s == &name) {
                    continue;
                }
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        dirs.push(entry.path());
                    } else if ft.is_file() {
                        if let Ok(meta) = entry.metadata() {
                            if meta.len() > MAX_FILE_BYTES {
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
                            if results.len() >= max {
                                break;
                            }
                            let matched = if let Some(ref re) = use_regex {
                                re.is_match(line)
                            } else {
                                line.to_lowercase().contains(&q_lower)
                            };
                            if matched {
                                results.push(format!("{}:{}: {}", path_str, i + 1, line));
                            }
                        }
                    }
                }
            }
        }
        results
    })
    .await
    .map_err(|e| format!("Regex search failed: {e}"))?;

    // If regex found results or query is clearly regex, return regex results
    if !regex_results.is_empty() || is_regex_query {
        if regex_results.is_empty() {
            return Ok("(no matches)".to_string());
        }
        return Ok(clip(&regex_results.join("\n"), MAX_OUTPUT_CHARS));
    }

    // Supplement with vector search for semantic understanding
    let vec_root = resolved_root.clone();
    let vec_query = query.to_string();
    let additional = tokio::task::spawn_blocking(move || -> Vec<String> {
        match crate::vector_search::search_codebase_vector(&vec_query, &vec_root, max) {
            Ok(results) => results
                .into_iter()
                .map(|r| format!("{}:{}: {} [score={:.3}]", r.path, r.line, r.content, r.score))
                .collect(),
            Err(e) => {
                eprintln!("Vector search error: {e}");
                Vec::new()
            }
        }
    })
    .await
    .map_err(|e| format!("Vector search failed: {e}"))?;

    if additional.is_empty() {
        return Ok("(no matches)".to_string());
    }

    Ok(clip(&additional.join("\n"), MAX_OUTPUT_CHARS))
}
