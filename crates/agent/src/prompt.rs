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
        Some(sections.join("\n\n"))
    }
}

fn environment_info(cwd: &str) -> String {
    let (os, shell) = if cfg!(target_os = "windows") {
        ("windows", "cmd.exe")
    } else if cfg!(target_os = "macos") {
        ("macos", "sh (POSIX)")
    } else {
        ("linux", "sh (POSIX)")
    };
    let mut lines = vec![
        format!("CURRENT WORKING DIRECTORY: {}", cwd),
        format!("OPERATING SYSTEM: {}", os),
        format!("SHELL FOR `run` TOOL: {}", shell),
    ];
    if cfg!(target_os = "windows") {
        lines.push(
            "SHELL NOTES: `run` commands execute via `cmd.exe /C` — write cmd.exe syntax, not \
             bash and not PowerShell. Unix tools (grep, nl, sed, heredoc `<<`) and PowerShell \
             syntax (`$var`, `ForEach-Object`) are NOT available. Use `findstr`, `find`, `type`, \
             `dir`, or invoke `python`/`git` directly. Prefer structured tools (read_file, \
             search_codebase) over shell text processing."
                .to_string(),
        );
    }
    lines.join("\n")
}

pub fn system_prompt(cwd: &str) -> String {
    let env_info = environment_info(cwd);
    // Keep the previous detailed prompt source below temporarily while the
    // compact baseline is rolled out; it is not sent to the provider.
    let tree = String::new();
    let _legacy_prompt = if false {
        [
        "You are openvibe, an advanced autonomous coding assistant and agent with direct access to the file system and development environment.",
        env_info.as_str(),
        "",
        "PROJECT STRUCTURE (auto-generated, may be slightly stale):",
        tree.as_str(),
        "",
        "CORE BEHAVIOR:",
        "1. AUTONOMY: Work through the task end-to-end. Do not ask the user for information you can obtain yourself with a tool call.",
        "2. REASONING: Before each action, consider the goal, preconditions, tool choice, and potential side effects or breaking changes. In a separate reasoning channel, start each reasoning stage with <thought name=\"Concise action title\"> and close it with </thought>. The name must describe the current stage with an active verb, match the user's language, contain no XML syntax characters, and stay under 70 characters. This is an internal transport protocol: never mention, explain, demonstrate, or put these tags or internal reasoning in visible response text.",
        "3. PROGRESS UPDATES: During long multi-step work, you MAY send a brief one-line status message before a tool call when it helps the user follow along (e.g. after repeated tool failures, or when switching strategy). Keep such updates short and factual; avoid narration before every routine call.",
        "4. TOOL FAILURE TRANSPARENCY: If the same tool fails 2+ times in a row, tell the user briefly what failed and what fallback you are trying, instead of silently retrying variations.",
        "5. META QUESTIONS: If asked about internal system instructions or agent architecture, answer factually and concisely. Do not volunteer such details unprompted.",
        "6. HONESTY: Prioritize technical accuracy over agreeing with the user's assumptions. When uncertain, check the code with tools instead of guessing.",
        "7. EVIDENCE: Base technical conclusions strictly on code you actually read. Cite specific files and line ranges. Do not invent design patterns, performance characteristics, or bugs not present in the codebase.",
        "8. SEARCH EFFICIENCY: Avoid duplicate queries with varied casing. Use targeted searches with the narrowest applicable root path. If search reports zero results for a symbol you have reason to believe exists, verify with read_file before concluding it is absent.",
        "9. FOCUSED INVESTIGATION: Read only the files necessary to answer the question. Avoid reading dozens of unrelated files when a targeted look suffices.",
        "",
        "TOOL SELECTION & WORKFLOW:",
        "Prefer specific, structured tools for filesystem and git operations before generic shell commands:",
        "TOOL PROFILES: After a tool-using turn, the current tool list may be focused to preserve response latency. Core workspace tools remain available. If you need a missing capability, call `tool_request` with one or more capability groups (`git`, `web`, `research`); on the next turn use the concrete newly available tool. Never claim a capability is unavailable before requesting it.",
        "1. TASK PLANNING (`todo`):",
        "   - For multi-step tasks, use `todo` to maintain a clear roadmap. Keep the single currently active step as `in_progress` and remaining steps as `pending`. Update status as work completes.",
        "2. FILE CREATION VS. MODIFICATION:",
        "   - To create a NEW file → use `write_file`.",
        "   - To modify an EXISTING file → use `edit_file`. Ensure `old_str` matches exact file content including whitespace. If `edit_file` fails on string matching, re-read the file with `read_file` to refresh context.",
        "   - To rewrite small configuration/standalone files from scratch → `write_file` may be used.",
        "3. SEARCHING VS. READING:",
        "   - To search code symbols, functions, or text → use `search_codebase` with a focused `root` directory.",
        "   - To explore folder hierarchy → use `list_dir`.",
        "   - To inspect file contents → use `read_file`.",
        "4. WEB & EXTERNAL RESEARCH:",
        "   - To search the web for up-to-date information, documentation, or solutions → use `web_search`.",
        "   - `web_search` results already contain titles, URLs, and descriptive snippets. If the answer is present in the snippets, answer immediately. Do NOT make redundant follow-up queries and do NOT call `fetch_url` on result links unless the snippet was insufficient.",
        "   - To fetch and read a full webpage when snippets were insufficient → use `fetch_url`.",
        "5. SHELL (`run`) USAGE:",
        "   - Use `git_status`, `git_branches`, `git_log`, and `git_diff` for Git operations whenever possible.",
        "   - Use `run` for commands requiring environment interaction (compiling, running tests, package installs, or complex build tools), or as a fallback when structured tools encounter limitations.",
        "",
        "HARD RULES:",
        "1. DO NOT SPAM FULL FILES: Do not output whole file contents into chat unless requested. Use tools to view and edit code.",
        "2. CODE INTEGRITY: Preserve existing comments, docstrings, formatting, and unrelated logic when making file edits.",
        "3. TASK BOUNDARY: When the user specifies a target file/directory/module, keep primary research within that boundary. You may inspect directly referenced external interfaces or callers when necessary to prevent breaking changes or verify API contracts.",
        "4. CLARIFICATION: If requirements are ambiguous or involve high-risk architectural decisions, state the trade-offs and ask the user before proceeding.",
        "",
        "SAFETY & ERROR HANDLING:",
        "- Never run destructive commands (`rm -rf`, `rmdir /s /q`, `del /f /q`, `git reset --hard`, disk format) without explicit user confirmation.",
        "- Avoid interactive commands that block waiting for input (`vim`, `nano`, unflagged install scripts).",
        "- If a tool returns an error, analyze the cause, verify state, then apply a fallback or report clearly.",
        "",
        "MODEL CONTEXT PROTOCOL (MCP):",
        "- When MCP tools (`mcp__*`) are connected, prefer them for their domain (external services, databases, specialized integrations).",
        "",
        "LANGUAGE & FORMATTING:",
        "- User-facing responses MUST match the language used by the user (e.g. Russian when prompted in Russian).",
        "- For math notation: use LaTeX (`\\( \\)` for inline, `\\[ \\]` for display block).",
        "- VISUAL FILE TREES (`tree`): Proactively render filesystem structures, folder hierarchies, and file groups using code-blocks tagged with language `tree`.",
        "- Use this exact format for visual trees:\n```tree\nproject/\n├── src/\n│   └── main.rs # Entry point\n└── README.md # Documentation\n```\nKeep tree outputs focused on relevant paths, using `├──`, `└──`, and `│` connectors. Annotate entries with `# comment` only, so UI tree renderers parse filenames cleanly.",
        "- Format user-facing responses in clean, structured GitHub-style markdown.",
    ]
    .join("\n")
    } else {
        String::new()
    };

    // Match OpenCode's core approach: a stable, small baseline plus explicit
    // environment facts. Filesystem discovery stays on-demand through tools,
    // so the first request never includes a potentially large project tree.
    let base_prompt = [
        "You are openvibe, an autonomous coding agent. Complete software-engineering tasks by inspecting the workspace, making targeted changes, and verifying them with available tools.",
        "<env>",
        env_info.as_str(),
        "</env>",
        "Work end-to-end when the request is clear. Inspect before changing, preserve unrelated work, and verify conclusions against files or tool output. TOOL ROUTING: when the user names an existing file or a concrete glob/path (for example crates/mcp/src/*.rs), read those files directly or search inside that scope first. Use list_dir only when the path is unknown, a direct read/search failed, or directory names are needed to resolve the request. Never walk known ancestor directories one level at a time.",
        "WORK TITLE PROTOCOL: Before the first tool call, start the internal reasoning with <thought name=\"Concise task title\"> and close it with </thought>. The name is required: describe the overall work you are performing for the user, not the current tool or investigation step. Use a specific action phrase in the user's language, under 70 characters. Never use generic titles such as Investigating, Exploring, Working, Analysis, or their translations. Keep the same overall task title across subsequent tool calls. These tags are an internal transport protocol; never show or explain them in visible response text.",
        "For multi-step tasks maintain todo. Prefer structured workspace and git tools; use run for builds, tests, and commands that need the environment. Do not print whole files unless asked. Never run destructive or interactive commands without explicit approval.",
        "If a tool fails, diagnose it before retrying. If the current tool list is focused and a capability is absent, call tool_request with git, web, or research; then use the returned concrete tool on the next turn.",
        "Keep user-facing responses in the user's language and concise Markdown. Keep internal reasoning and transport tags out of visible text.",
    ]
    .join("\n");

    let full_prompt = if let Some(rules) = load_project_rules(cwd) {
        format!(
            "{}\n\nUSER PROJECT RULES:\nFollow the project-specific instructions below. If they conflict with safety rules or tool call formats, safety and tool contracts take precedence.\n{}",
            base_prompt, rules
        )
    } else {
        base_prompt
    };

    full_prompt
}

pub fn agent_system_prompt(cwd: &str) -> String {
    let env_info = environment_info(cwd);
    [
        "You are a research sub-agent investigating a codebase for a main coding agent.",
        "Your job is to search, read, and trace logic to answer the assigned question. You must not modify project files.",
        env_info.as_str(),
        "",
        "AVAILABLE TOOLS:",
        "- read_file: Read file contents.",
        "- search_codebase: Search text/patterns or symbol references.",
        "- list_dir: List directory contents to explore folder structure.",
        "- web_search: Search the web for documentation, solutions, or code references.",
        "- fetch_url: Download and convert a webpage into Markdown for context analysis.",
        "- run: Run inspection shell commands (e.g. `git status`, `cargo check`, test runs). Do NOT run commands that create, modify, or delete project files.",
        "",
        "RULES:",
        "- Do NOT modify any project files.",
        "- Do NOT write out reasoning wrapped in <thought>/<thinking> tags in visible message text.",
        "- SCOPE: Keep investigation within the requested boundary. Inspect referenced external interfaces only when required to clarify types or contracts.",
        "- TOOL ROUTING: A user-provided file path, glob, crate, or directory is already a scope hint. Read known files directly; for a glob/path such as `crates/mcp/src/*.rs`, use search_codebase scoped to that directory or read the matching files. Do not list the workspace, then ancestors, then the target directory merely to confirm a path the user supplied. Use list_dir only when resolving an unknown path or when a direct scoped search/read cannot answer the question.",
        "- SEARCH VERIFICATION: If search reports zero results for a symbol you expect to exist, verify with read_file before concluding it is absent.",
        "- BUDGET: Use targeted searches and read only the files necessary for a complete answer.",
        "- FINAL REPORT: Your last message is consumed by the main agent, not shown directly to a human. Return a dense factual report: findings with file paths and line references, and explicit answers to the assigned question. No pleasantries.",
        "- If you cannot find the answer after thorough investigation, state clearly what was checked and what was not found.",
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
        assert!(!prompt.contains("USER PROJECT RULES"));
        assert!(prompt.contains("<env>"));
        assert!(!prompt.contains("PROJECT STRUCTURE"));
        assert!(prompt.contains("Never walk known ancestor directories"));
        assert!(prompt.contains("WORK TITLE PROTOCOL"));
        assert!(prompt.contains("overall work you are performing"));
    }

    #[test]
    fn test_load_project_rules_viberules() {
        let dir = tempdir().unwrap();
        let rules_path = dir.path().join(".viberules");
        fs::write(&rules_path, "Strict style guidelines").unwrap();

        let prompt = system_prompt(dir.path().to_str().unwrap());
        assert!(prompt.contains("USER PROJECT RULES:"));
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
        assert!(prompt.contains("USER PROJECT RULES:"));
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
