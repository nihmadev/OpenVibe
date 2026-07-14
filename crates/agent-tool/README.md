# `agent-tool` Crate

The `agent-tool` crate defines and implements built-in tool execution capabilities for the OpenVibe AI agent. It equips the agent with essential workspace interactions, including file system read/write operations, precise patch edits, directory browsing, shell command execution, codebase searching, sub-agent spawning, and Model Context Protocol (MCP) server invocations.

---

## Overview and Key Features

- **File Operations**: Provides `read_file` for inspectable text retrieval and `write_file` for new file creation.
- **Precise Modifications**: Provides `edit_file` to locate exact string snippets (`old_str`) and swap them with modified content (`new_str`).
- **Workspace Navigation**: Provides `list_dir` to retrieve directory listings and file metadata across workspace paths.
- **System Command Execution**: Provides `bash` for executing shell commands with configurable timeouts, capturing standard output and error channels.
- **Codebase Search Integration**: Exposes `search_codebase` to run structural, regex, or semantic vector queries via the `search` crate engine.
- **Sub-Agent Invocation**: Provides `agent` to launch isolated sub-agents for dedicated, multi-step investigation tasks.
- **MCP Extensibility**: Connects tool calls to external Model Context Protocol (MCP) servers.
- **Read-Only Mode**: Provides `build_readonly_tool_definitions()` for secure execution during non-destructive sub-agent tasks.

---

## Architecture and Modules

| Module | Description |
| :--- | :--- |
| `definition` ([`src/definition.rs`](src/definition.rs)) | Defines tool specifications (`build_tool_definitions`, `build_readonly_tool_definitions`) and JSON schemas. |
| `executor` ([`src/executor.rs`](src/executor.rs)) | Implements `AgentToolExecutor`, implementing the `ToolExecutor` trait from the `agent` crate. |
| `execute` ([`src/execute.rs`](src/execute.rs)) | Dispatches tool call requests by matching function names to specific handlers. |
| `read` ([`src/read.rs`](src/read.rs)) | Handles file reading logic. |
| `write` ([`src/write.rs`](src/write.rs)) | Handles new file creation logic. |
| `edit` ([`src/edit.rs`](src/edit.rs)) | Handles precise string replacement in existing files. |
| `list_dir` ([`src/list_dir.rs`](src/list_dir.rs)) | Handles directory traversal and entry enumeration. |
| `bash` ([`src/bash.rs`](src/bash.rs)) | Executes asynchronous shell processes with timeouts. |
| `search` ([`src/search.rs`](src/search.rs)) | Integrates with codebase searching capabilities. |
| `agent_tool` ([`src/agent_tool.rs`](src/agent_tool.rs)) | Manages sub-agent lifecycle and execution flows. |

---

## Usage Example

```rust
use agent_tool::{build_tool_definitions, AgentToolExecutor};

#[tokio::main]
async fn main() {
    // Retrieve standard tool definitions
    let tool_defs = build_tool_definitions();
    println!("Loaded {} tool definitions", tool_defs.len());

    // Initialize tool executor for a workspace directory
    let executor = AgentToolExecutor::new("./".to_string());

    // Pass executor to Agent runtime
}
```

---

## Dependencies

- **Internal Workspace Dependencies**:
  - [`agent`](../agent) — Defines `ToolExecutor` trait and core tool schema types.
  - [`search`](../search) — Codebase search and indexing engine.
  - [`mcp`](../mcp) — Model Context Protocol manager and process runner.
- **External Dependencies**:
  - `tokio` — Asynchronous I/O and process execution.
  - `serde`, `serde_json` — Tool definition parameters and serialization.
  - `regex` — Pattern matching.
