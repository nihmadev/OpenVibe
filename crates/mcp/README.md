# `mcp` Crate

The `mcp` crate provides an implementation of the Model Context Protocol (MCP) client for OpenVibe. It manages external MCP server configurations (`mcp.json`), spawns and monitors child processes communicating over stdio/HTTP protocols, injects augmented system environment paths, and tracks MCP server execution health.

---

## Overview and Key Features

- **MCP Configuration Management**: Reads and writes `mcp.json` configuration files with support for flexible arguments, environment variable maps, and custom server paths.
- **Process Lifecycle Control**: Manages child processes (`McpServerProcess`) running external MCP servers (e.g. Node.js or Python MCP servers) over stdio.
- **MCP Manager**: Coordinates multiple active MCP servers, handles startup/shutdown sequences, and aggregates available MCP tools.
- **Path Augmentation**: Constructs augmented system `PATH` environments (`build_augmented_path`) to discover node, npx, python, and UV runtimes.
- **Status Monitoring**: Tracks real-time MCP server states (`McpStatus`, `McpServerStatus`) such as Connected, Disconnected, or Failed.

---

## Architecture and Modules

| Module                                         | Description                                                                                                   |
| :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------ |
| `config` ([`src/config.rs`](src/config.rs))    | Configuration loading (`load_mcp_config`, `save_mcp_config`), path resolution, and resilient deserialization. |
| `manager` ([`src/manager.rs`](src/manager.rs)) | `McpManager` orchestrator for starting, stopping, and routing requests across configured MCP servers.         |
| `process` ([`src/process.rs`](src/process.rs)) | `McpServerProcess` handling low-level stdin/stdout communication and JSON-RPC messages.                       |
| `path` ([`src/path.rs`](src/path.rs))          | System path resolution and runtime binary discovery (`node`, `python3`, `npx`).                               |
| `types` ([`src/types.rs`](src/types.rs))       | Status structures `McpStatus` and `McpServerStatus`.                                                          |
| `server` ([`src/server.rs`](src/server.rs))    | Server connection parameters and options.                                                                     |

---

## Usage Example

```rust
use mcp::{load_mcp_config, McpManager};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let workspace_dir = "./";

    // Load mcp.json configuration
    let config = load_mcp_config(workspace_dir)?;
    println!("Found {} MCP server configurations", config.mcp_servers.len());

    // Initialize MCP Manager
    let mut manager = McpManager::new();
    manager.start_all(&config).await?;

    // Check status
    let status = manager.get_status().await;
    println!("Active MCP servers: {:?}", status);

    Ok(())
}
```

---

## Dependencies

- **External Dependencies**:
  - `tokio` — Asynchronous child process management and I/O streams.
  - `serde`, `serde_json` — JSON-RPC communication and configuration parsing.
  - `toml` — TOML configuration format support.
  - `tracing` — Execution and error logging.
