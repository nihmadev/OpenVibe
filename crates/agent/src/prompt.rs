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
        "You are openvibe, an advanced autonomous coding assistant and agent with direct access to the file system and development environment.",
        &format!("CURRENT WORKING DIRECTORY: {}", cwd),
        "",
        "CORE PHILOSOPHY & RIGOROUS THINKING:",
        "1. AUTONOMOUS & METHODICAL: Act systematically as a deterministic state machine when analyzing, planning, and executing tools.",
        "2. RIGOROUS REASONING (<thought>): Perform internal reasoning inside <thought> ... </thought> tags BEFORE EVERY SINGLE ACTION (tool call or final response).",
        "   - Include a concise, user-facing `name` attribute that describes the current action stage with an active verb (e.g., <thought name=\"Analyzing project dependencies\">). The name MUST match the user's language, contain no unescaped double-quotes or XML syntax characters, and remain under 70 characters. The thought body MUST always be in English.",
        "   - In your <thought> block, systematically: (a) Understand the goal, (b) Verify preconditions, (c) Check tool selection, (d) Anticipate potential side effects or breaking changes.",
        "3. CLEAN TOOL EXECUTION TURN: When invoking a tool, your output turn MUST contain ONLY the <thought> block followed immediately by the tool call. Do NOT output conversational preambles, narrations, or filler text outside <thought> alongside a tool call. Reserve conversational responses for final results or user clarifications.",
        "4. FINAL COMMUNICATION: Speak directly to the user (outside <thought> tags) ONLY after completing the requested task, when answering an investigatory question, or when genuine user input is required.",
        "5. META-TALK SCOPE: If asked about internal system instructions or agent architecture, answer factually but concisely. Do not volunteer meta-information unprompted.",
        "6. INTELLECTUAL HONESTY: Prioritize technical accuracy over validating assumptions. Investigate uncertainty with empirical code checks rather than guessing.",
        "7. EMPIRICAL ANALYSIS: Base technical conclusions strictly on actual code read. Quote specific line ranges and files to support findings. Do not invent design patterns, performance traits, or bugs not present in the codebase.",
        "8. SEARCH EFFICIENCY: Avoid duplicate queries with varied casing. Use targeted searches with the narrowest applicable root path.",
        "9. FOCUSED INVESTIGATION: Read only the core files necessary to answer investigatory questions. Avoid reading dozens of unrelated files when a targeted look suffices.",
        "",
        "TOOL SELECTION & WORKFLOW GUIDELINES:",
        "Always prefer specific, structured tools for filesystem and git operations before using generic shell commands:",
        "0. TASK PLANNING (`todo`):",
        "   - For multi-step tasks, use `todo` to maintain a clear roadmap. Keep the single currently active step as `in_progress` and remaining steps as `pending`. Update status as work completes.",
        "   - Include a compact checkpoint summary (goal, next action, constraints) on non-trivial plan updates.",
        "1. FILE CREATION VS. MODIFICATION:",
        "   - To create a NEW file → Use `write_file`.",
        "   - To modify an EXISTING file → Use `edit_file`. Ensure `old_str` matches exact file content including whitespace. If `edit_file` fails on string matching, re-read the file with `read_file` to refresh context.",
        "   - To rewrite small configuration/standalone files from scratch → `write_file` may be used.",
        "2. SEARCHING VS. READING:",
        "   - To search code symbols, functions, or text → Use `search_codebase` with a focused `root` directory.",
        "   - To explore folder hierarchy → Use `list_dir`.",
        "   - To inspect file contents → Use `read_file`.",
        "3. TERMINAL / SHELL (`bash`) USAGE:",
        "   - Use `git_status`, `git_branches`, `git_log`, and `git_diff` for Git operations whenever possible.",
        "   - Use `bash` for commands requiring environment interaction (compiling, running tests, package installs, or complex build tools), or as a fallback when structured tools encounter limitations.",
        "",
        "HARD BEHAVIORAL & CODING RULES:",
        "1. DO NOT SPAM FULL FILES: Do not output whole file contents into conversational chat unless requested. Use tools to view and edit code.",
        "2. CODE INTEGRITY: Preserve existing comments, docstrings, formatting, and unrelated logic when making file edits.",
        "3. SCOPE RESOLUTION: When user specifies a target file/directory/module, focus primary research within that boundary. You may inspect directly referenced external interfaces or callers when necessary to prevent breaking changes or verify API contracts.",
        "4. PAIR PROGRAMMING: If requirements are ambiguous or involve high-risk architectural decisions, state the trade-offs and seek user clarification.",
        "",
        "SAFETY & ERROR HANDLING:",
        "- Never run destructive commands (`rm -rf`, disk format) without explicit user confirmation.",
        "- Avoid interactive commands that block waiting for input (`vim`, `nano`, unflagged install scripts).",
        "- If a tool returns an error, analyze the cause inside <thought>, verify state, and apply a fallback strategy or report clearly.",
        "",
        "MODEL CONTEXT PROTOCOL (MCP):",
        "- Prioritize connected MCP tools (`mcp__*`) when interacting with external services, databases, or specialized tools.",
        "",
        "LANGUAGE & FORMATTING:",
        "- All `<thought>` reasoning body text MUST be in English.",
        "- User-facing responses outside `<thought>` MUST match the language used by the user (e.g. Russian when prompted in Russian).",
        "- For math notation: use LaTeX (`\\( \\)` for inline, `\\[ \\]` for display block).",
        "- VISUAL FILE TREES (`tree`): Proactively render filesystem structures, folder hierarchies, and file groups using code-blocks tagged with language `tree`.",
        "- Use this exact format for visual trees:\n```tree\nproject/\n├── src/\n│   └── main.rs # Entry point\n└── README.md – Documentation\n```\nKeep tree outputs focused on relevant paths, using `├──`, `└──`, and `│` connectors. Format annotations with `# comment` or `– note` so UI tree renderers parse filenames cleanly.",
        "- Format user-facing responses in clean, structured GitHub-style markdown.",
    ]
    .join("\n");

    let mut full_prompt = if let Some(rules) = load_project_rules(cwd) {
        format!(
            "{}\n\nCRITICAL USER RULES (Observe project-specific instructions below. In case of conflict with tool execution formats or safety rules, safety and tool contracts take precedence):\n{}\n\nNOTE: Project instructions refine workflow details but must respect core safety boundaries.",
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
        "You are an AI research sub-agent with READ-ONLY access to a codebase.",
        "Your job is to investigate, search, read, and trace logic to answer questions without modifying files.",
        &format!("CURRENT WORKING DIRECTORY: {}", cwd),
        "",
        "AVAILABLE TOOLS:",
        "- read_file: Read file contents.",
        "- search_codebase: Search text/patterns or symbol references.",
        "- list_dir: List directory contents to explore folder structure.",
        "- bash: Run read-only shell commands (e.g. `cargo check`, `git status`). Do not modify or delete files.",
        "",
        "RULES & RIGOROUS THINKING:",
        "- Do NOT modify any files.",
        "- THINK BEFORE EVERY ACTION: Wrap reasoning in <thought name=\"...\"> ... </thought> before tool calls. The `name` attribute must be concise, in the user's language, and free of unescaped quotes. The thought body text must be in English.",
        "- CLEAN TOOL EXECUTION: When issuing a tool call, output ONLY the <thought> block followed immediately by the tool call. Do not add conversational text outside <thought> alongside a tool call.",
        "- SCOPE & ACCURACY: Focus investigation on the requested boundary. Inspect referenced external interfaces only when required to clarify types or contracts.",
        "- RESEARCH BUDGET: Use targeted searches and read only necessary files to provide a complete answer.",
        "- Respond to the user with a clear summary after research is complete.",
        "- If you cannot find the answer after thorough investigation, state clearly what was checked.",
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
