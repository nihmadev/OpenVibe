use std::fs;
use std::path::Path;

const RULE_FILES: &[&str] = &[
    ".viberules",
    "AGENTS.md",
    ".cursorrules",
    ".openvibe/rules",
    ".openvibe/rules.md",
];

const MAX_RULE_FILE_BYTES: usize = 20 * 1024;

fn load_project_rules(cwd: &str) -> Option<String> {
    let mut sections = Vec::new();

    for relative_path in RULE_FILES {
        let path = Path::new(cwd).join(relative_path);
        if !path.exists() || !path.is_file() {
            continue;
        }

        match fs::read_to_string(&path) {
            Ok(content) => {
                let trimmed = content.trim();
                if trimmed.is_empty() {
                    continue;
                }

                let (final_content, is_truncated) = if trimmed.len() > MAX_RULE_FILE_BYTES {
                    let mut boundary = MAX_RULE_FILE_BYTES;
                    while boundary > 0 && !trimmed.is_char_boundary(boundary) {
                        boundary -= 1;
                    }
                    (&trimmed[..boundary], true)
                } else {
                    (trimmed, false)
                };

                let mut section =
                    format!("--- Rules from {} ---\n{}", relative_path, final_content);
                if is_truncated {
                    section.push_str("\n[Rules truncated for context length]");
                }
                section.push_str("\n--- End of Rules ---");

                sections.push(section);
            }
            Err(err) => {
                tracing::warn!(
                    "Failed to read project rules from {}: {}",
                    path.display(),
                    err
                );
            }
        }
    }

    if sections.is_empty() {
        None
    } else {
        Some(format!(
            "USER PROJECT RULES AND CONSTRAINTS:\n{}",
            sections.join("\n\n")
        ))
    }
}

pub fn system_prompt(cwd: &str) -> String {
    system_prompt_with_scg2(cwd, None)
}

pub fn system_prompt_with_scg2(cwd: &str, scg2_context: Option<&str>) -> String {
    let base_prompt = [
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
        "MODEL CONTEXT PROTOCOL (MCP):",
        "- You have full access to Model Context Protocol (MCP) servers and tools when they are connected and enabled.",
        "- MCP tools are dynamically provided in your available functions list with names like `mcp__<server>__<tool>` (e.g. `mcp__godot__...`, `mcp__github__...`).",
        "- When the user asks to interact with an MCP server or perform tasks involving connected services (e.g. Godot, GitHub, filesystem), call the corresponding `mcp__*` tools.",
        "",
        "For math: use LaTeX format (\\( \\) inline, \\[ \\] block).",
    ]
    .join("\n");

    let mut full_prompt = if let Some(rules) = load_project_rules(cwd) {
        format!(
            "{}\n\nCRITICAL USER RULES (Always observe these project-specific instructions):\n{}",
            base_prompt, rules
        )
    } else {
        base_prompt
    };

    if let Some(ctx) = scg2_context {
        if !ctx.trim().is_empty() {
            full_prompt.push_str("\n\n");
            full_prompt.push_str(ctx);
        }
    }

    full_prompt
}

pub fn agent_system_prompt(cwd: &str) -> String {
    [
        "You are an AI research assistant with READ-ONLY access to a codebase.",
        "Your ONLY job is to investigate and find information — never modify files.",
        &format!("CURRENT WORKING DIRECTORY: {}", cwd),
        "",
        "AVAILABLE TOOLS:",
        "- read_file: Read file contents.",
        "- search_codebase: Search for text/patterns in the codebase.",
        "- list_dir: List directory contents.",
        "- bash: Run shell commands (read-only). NEVER modify or delete files.",
        "",
        "RULES:",
        "- Do NOT modify any files under any circumstances.",
        "- Be thorough and methodical. Search first, then read specific files.",
        "- When you have found the answer, provide a clear, comprehensive summary.",
        "- If you cannot find the answer, say so clearly.",
    ]
    .join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_system_prompt_without_rules() {
        let dir = tempdir().unwrap();
        let prompt = system_prompt(dir.path().to_str().unwrap());
        assert!(!prompt.contains("CRITICAL USER RULES"));
    }

    #[test]
    fn test_load_project_rules_viberules() {
        let dir = tempdir().unwrap();
        let rules_path = dir.path().join(".viberules");
        fs::write(&rules_path, "Strict style guidelines").unwrap();

        let prompt = system_prompt(dir.path().to_str().unwrap());
        assert!(prompt.contains("CRITICAL USER RULES"));
        assert!(prompt.contains("USER PROJECT RULES AND CONSTRAINTS:"));
        assert!(prompt.contains("--- Rules from .viberules ---"));
        assert!(prompt.contains("Strict style guidelines"));
        assert!(prompt.contains("--- End of Rules ---"));
    }

    #[test]
    fn test_load_project_rules_agents_md() {
        let dir = tempdir().unwrap();
        let agents_path = dir.path().join("AGENTS.md");
        fs::write(&agents_path, "Do not use direct unwrap").unwrap();

        let prompt = system_prompt(dir.path().to_str().unwrap());
        assert!(prompt.contains("CRITICAL USER RULES"));
        assert!(prompt.contains("--- Rules from AGENTS.md ---"));
        assert!(prompt.contains("Do not use direct unwrap"));
    }

    #[test]
    fn test_load_project_rules_truncation() {
        let dir = tempdir().unwrap();
        let rules_path = dir.path().join(".cursorrules");
        let large_content = "A".repeat(25 * 1024);
        fs::write(&rules_path, large_content).unwrap();

        let prompt = system_prompt(dir.path().to_str().unwrap());
        assert!(prompt.contains("--- Rules from .cursorrules ---"));
        assert!(prompt.contains("[Rules truncated for context length]"));
    }

    #[test]
    fn test_load_project_rules_nested() {
        let dir = tempdir().unwrap();
        let openvibe_dir = dir.path().join(".openvibe");
        fs::create_dir_all(&openvibe_dir).unwrap();
        let rules_path = openvibe_dir.join("rules.md");
        fs::write(&rules_path, "OpenVibe nested rule").unwrap();

        let prompt = system_prompt(dir.path().to_str().unwrap());
        assert!(prompt.contains("--- Rules from .openvibe/rules.md ---"));
        assert!(prompt.contains("OpenVibe nested rule"));
    }
}
