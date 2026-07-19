use agent::ToolDefinition;

pub fn build_tool_definitions() -> Vec<ToolDefinition> {
    let mut definitions = vec![
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "read_file".to_string(),
                description: "Read a UTF-8 text file from the local filesystem. Use this to see file contents, configuration, or source code.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute or relative path to the file" }
                    },
                    "required": ["path"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "write_file".to_string(),
                description: "Create a new file with the given content. NEVER use this on files that already exist - use edit_file instead.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute or relative path where the file should be created" },
                        "content": { "type": "string", "description": "Full file content" }
                    },
                    "required": ["path", "content"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "edit_file".to_string(),
                description: "Find an exact string in a file and replace it with a new string. Always use this for modifying existing files - NEVER use write_file on files that exist.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute or relative path to the file" },
                        "old_str": { "type": "string", "description": "The exact existing string to replace (must match exactly)" },
                        "new_str": { "type": "string", "description": "The new string to replace with" }
                    },
                    "required": ["path", "old_str", "new_str"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "list_dir".to_string(),
                description: "List all files and directories in a given directory. Use this to explore the project structure.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string", "description": "Absolute or relative path to the directory" }
                    },
                    "required": ["path"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "bash".to_string(),
                description: "Run a shell command in the project directory. Returns stdout + stderr. Use this for running tests, builds, or any CLI commands.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string", "description": "The shell command to execute" },
                        "timeout": { "type": "number", "description": "Optional timeout in milliseconds (default 30000)" }
                    },
                    "required": ["command"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "search_codebase".to_string(),
                description: "Search source text for specific symbols or strings. When the user names a file, directory, crate, or package, ALWAYS set root to that scope instead of searching the entire workspace.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Text or regex pattern to search for" },
                        "root": { "type": "string", "description": "Optional directory to restrict the search to; required when the user explicitly limits scope" }
                    },
                    "required": ["query"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "git_status".to_string(),
                description: "Show the current Git branch and working tree changes (read-only).".to_string(),
                parameters: serde_json::json!({"type":"object","properties":{"path":{"type":"string","description":"Optional path inside the repository"}}}),
            },
        },
        ToolDefinition { type_: "function".to_string(), function: agent::ToolDefFunction {
                name: "git_branches".to_string(), description: "List local and remote Git branches (read-only).".to_string(), parameters: serde_json::json!({"type":"object","properties":{}}),
            }, },
        ToolDefinition { type_: "function".to_string(), function: agent::ToolDefFunction {
                name: "git_log".to_string(), description: "List recent Git commits from a branch, tag, or commit without checking it out (read-only).".to_string(), parameters: serde_json::json!({"type":"object","properties":{"ref":{"type":"string","description":"Branch, remote branch, tag, or commit SHA; defaults to HEAD"},"max_count":{"type":"integer","minimum":1,"maximum":100}}}),
            }, },
        ToolDefinition { type_: "function".to_string(), function: agent::ToolDefFunction {
                name: "git_diff".to_string(), description: "Show working tree changes or compare Git branches, tags, and commits (read-only).".to_string(), parameters: serde_json::json!({"type":"object","properties":{"staged":{"type":"boolean","description":"Compare staged changes with HEAD"},"base":{"type":"string","description":"Base branch, tag, or commit"},"target":{"type":"string","description":"Optional target branch, tag, or commit"},"path":{"type":"string","description":"Optional file or directory filter"}}}),
            }, },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "todo".to_string(),
                description: "Create or update the persistent execution plan and checkpoint memory. Use one task entry per requested outcome. Use stable ids, priorities, dependencies, acceptance criteria, next_action and evidence. Preserve user_locked tasks and call again with the full list whenever progress changes. There is no one-active-task limit: independent tasks may be in_progress at the same time; keep dependent tasks pending until their dependencies complete, then advance all eligible next tasks together. Pass an empty list to clear the plan.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "tasks": {
                            "type": "array",
                            "description": "The complete current task plan. Keep every requested outcome as its own entry; order is priority/display order, not a limit on parallel execution.",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "title": { "type": "string", "description": "Concise task title" },
                                    "id": { "type": "string", "description": "Stable task id; preserve it across updates" },
                                    "status": {
                                        "type": "string",
                                        "enum": ["pending", "in_progress", "blocked", "waiting_user", "completed", "skipped"]
                                    },
                                    "priority": { "type": "string", "enum": ["critical", "high", "normal", "low"] },
                                    "order": { "type": "integer" },
                                    "dependsOn": { "type": "array", "items": { "type": "string" } },
                                    "acceptanceCriteria": { "type": "array", "items": { "type": "string" } },
                                    "nextAction": { "type": "string" },
                                    "blocker": { "type": "string" },
                                    "evidence": { "type": "array", "items": { "type": "string" } },
                                    "owner": { "type": "string", "enum": ["agent", "user", "subagent"] },
                                    "userLocked": { "type": "boolean" }
                                },
                                "required": ["title", "status"],
                                "additionalProperties": false
                            }
                        },
                        "checkpoint": {
                            "type": "object",
                            "description": "Compact resume packet for context recovery",
                            "properties": {
                                "goal": { "type": "string" },
                                "summary": { "type": "string" },
                                "nextAction": { "type": "string" },
                                "blockers": { "type": "array", "items": { "type": "string" } },
                                "constraints": { "type": "array", "items": { "type": "string" } },
                                "changedFiles": { "type": "array", "items": { "type": "string" } }
                            },
                            "additionalProperties": false
                        }
                    },
                    "required": ["tasks"],
                    "additionalProperties": false
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "agent".to_string(),
                description: "Perform bounded read-only research when several targeted searches or reads are genuinely required. Preserve every scope restriction from the user in the task, and do not use this for a single crate or directory that can be inspected directly.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "task": { "type": "string", "description": "The research task to investigate. Be specific about what to find." }
                    },
                    "required": ["task"]
                }),
            },
        },
    ];
    definitions.extend(extra_git_tool_definitions());
    definitions
}

pub fn build_readonly_tool_definitions() -> Vec<ToolDefinition> {
    let mut definitions = vec![
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "read_file".to_string(),
                description: "Read file contents.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "list_dir".to_string(),
                description: "List directory contents.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "path": { "type": "string" }
                    },
                    "required": ["path"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "search_codebase".to_string(),
                description: "Search the codebase.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "root": { "type": "string", "description": "Optional directory that bounds the search" }
                    },
                    "required": ["query"]
                }),
            },
        },
    ];
    definitions.extend(git_tool_definitions());
    definitions
}

fn git_tool(
    name: &str,
    description: &str,
    properties: serde_json::Value,
    required: &[&str],
) -> ToolDefinition {
    ToolDefinition {
        type_: "function".to_string(),
        function: agent::ToolDefFunction {
            name: name.to_string(),
            description: description.to_string(),
            parameters: serde_json::json!({
                "type": "object",
                "properties": properties,
                "required": required
            }),
        },
    }
}

fn git_tool_definitions() -> Vec<ToolDefinition> {
    vec![
        git_tool(
            "git_status",
            "Show Git branch and working tree status (read-only).",
            serde_json::json!({"path":{"type":"string"}}),
            &[],
        ),
        git_tool(
            "git_branches",
            "List local and remote Git branches (read-only).",
            serde_json::json!({"kind":{"type":"string","enum":["local","remote","all"]},"pattern":{"type":"string"}}),
            &[],
        ),
        git_tool(
            "git_log",
            "List commits from a ref (read-only).",
            serde_json::json!({"ref":{"type":"string"},"max_count":{"type":"integer","minimum":1,"maximum":100},"path":{"type":"string"},"author":{"type":"string"},"grep":{"type":"string"},"since":{"type":"string"},"until":{"type":"string"},"all":{"type":"boolean"},"first_parent":{"type":"boolean"}}),
            &[],
        ),
        git_tool(
            "git_diff",
            "Show working tree or ref differences (read-only).",
            serde_json::json!({"staged":{"type":"boolean"},"base":{"type":"string"},"target":{"type":"string"},"path":{"type":"string"},"format":{"type":"string","enum":["patch","stat","name_status","numstat"]},"context_lines":{"type":"integer"},"ignore_whitespace":{"type":"boolean"}}),
            &[],
        ),
        git_tool(
            "git_show",
            "Show commit metadata, patch, or file content at a ref (read-only).",
            serde_json::json!({"ref":{"type":"string"},"path":{"type":"string"},"mode":{"type":"string","enum":["metadata","patch","content"]}}),
            &[],
        ),
        git_tool(
            "git_blame",
            "Show line attribution for a file (read-only).",
            serde_json::json!({"path":{"type":"string"},"ref":{"type":"string"},"start_line":{"type":"integer"},"end_line":{"type":"integer"}}),
            &["path"],
        ),
        git_tool(
            "git_merge_base",
            "Find a merge base or test ancestry (read-only).",
            serde_json::json!({"base":{"type":"string"},"target":{"type":"string"},"mode":{"type":"string","enum":["merge_base","is_ancestor"]}}),
            &["base", "target"],
        ),
        git_tool(
            "git_tree",
            "List files in a ref without checkout (read-only).",
            serde_json::json!({"ref":{"type":"string"},"path":{"type":"string"},"recursive":{"type":"boolean"}}),
            &[],
        ),
        git_tool(
            "git_grep",
            "Search tracked content in a ref (read-only).",
            serde_json::json!({"query":{"type":"string"},"ref":{"type":"string"},"path":{"type":"string"}}),
            &["query"],
        ),
        git_tool(
            "git_check_ignore",
            "Explain ignore rules for paths (read-only).",
            serde_json::json!({"paths":{"type":"array","items":{"type":"string"}}}),
            &["paths"],
        ),
        git_tool(
            "git_stash_list",
            "List stashes (read-only).",
            serde_json::json!({}),
            &[],
        ),
        git_tool(
            "git_reflog",
            "Show local reference history (read-only).",
            serde_json::json!({"ref":{"type":"string"},"max_count":{"type":"integer","minimum":1,"maximum":100}}),
            &[],
        ),
        git_tool(
            "git_remotes",
            "List repository remotes (read-only).",
            serde_json::json!({}),
            &[],
        ),
        git_tool(
            "git_refs",
            "List tags, branches, or all refs (read-only).",
            serde_json::json!({"kind":{"type":"string","enum":["tags","heads","remotes","all"]},"pattern":{"type":"string"}}),
            &[],
        ),
        git_tool(
            "git_worktrees",
            "List linked worktrees (read-only).",
            serde_json::json!({}),
            &[],
        ),
        git_tool(
            "git_submodules",
            "Show submodule status (read-only).",
            serde_json::json!({}),
            &[],
        ),
    ]
}

fn extra_git_tool_definitions() -> Vec<ToolDefinition> {
    git_tool_definitions().into_iter().skip(4).collect()
}
