use agent::ToolDefinition;

pub fn build_tool_definitions() -> Vec<ToolDefinition> {
    vec![
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
                description: "Search the entire codebase for specific content, logic, or answers. This is the PRIMARY tool for finding WHERE something is implemented or searching for text. Use this for both regex patterns and natural language questions.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string", "description": "Filename or path pattern to search for" }
                    },
                    "required": ["query"]
                }),
            },
        },
        ToolDefinition {
            type_: "function".to_string(),
            function: agent::ToolDefFunction {
                name: "agent".to_string(),
                description: "Explore the codebase for complex research tasks that require multiple steps (searching, reading, analyzing). Use this instead of search_codebase when you need deep investigation — e.g. finding a bug, understanding architecture, or tracing logic across multiple files.".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "task": { "type": "string", "description": "The research task to investigate. Be specific about what to find." }
                    },
                    "required": ["task"]
                }),
            },
        },
    ]
}

pub fn build_readonly_tool_definitions() -> Vec<ToolDefinition> {
    vec![
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
                name: "bash".to_string(),
                description: "Run a shell command (read-only).".to_string(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "command": { "type": "string" }
                    },
                    "required": ["command"]
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
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }),
            },
        },
    ]
}

pub fn requires_confirmation(name: &str) -> bool {
    matches!(name, "bash")
}
