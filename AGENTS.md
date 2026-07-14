# MCP Server Implementation Plan

## Overview
Implement real MCP (Model Context Protocol) server support in OpenVibe. Users should be able to configure MCP servers, toggle them on/off, and see their connection status from the titlebar.

## New files to create

### Rust: `crates/mcp/`
New workspace crate `mcp` in `crates/mcp/` with:

- **`Cargo.toml`** — depends on `serde`, `serde_json`, `toml`, `tokio`, `tower`, `tower-lsp`, `tracing`. Add to workspace `Cargo.toml`.

- **`src/lib.rs`** — public API:
  - `McpConfig` struct — parsed from `openvibe.toml`
  - `McpServerConfig` — per-server: name, command (binary path), args, env (HashMap), enabled (bool)
  - `McpManager` — singleton holding all servers, spawns/kills child processes, tracks status (Running/Stopped/Error)
  - `McpStatus` enum: Running | Stopped | Error(String)

- **`src/config.rs`** — load/save `openvibe.toml` from project root. Format:
  ```toml
  [mcp]
  
  [[mcp.server]]
  name = "filesystem"
  command = "npx"
  args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
  enabled = true
  
  [[mcp.server]]
  name = "github"
  command = "uvx"
  args = ["mcp-server-github"]
  env = { GITHUB_TOKEN = "ghp_xxx" }
  enabled = false
  ```

- **`src/server.rs`** — process lifecycle:
  - Spawn as child process with stdio transport (MCP over stdin/stdout)
  - Parse JSON-RPC messages (initialize, tools/list, tools/call)
  - Heartbeat / liveness check
  - Graceful shutdown on kill

- **`src/commands.rs`** — Tauri commands exposed to frontend:
  - `mcp_get_servers` -> Vec<McpServerStatus>
  - `mcp_start_server(name: String)` -> Result
  - `mcp_stop_server(name: String)` -> Result
  - `mcp_restart_server(name: String)` -> Result
  - `mcp_get_status(name: String)` -> McpStatus
  - `mcp_get_config` -> McpConfig
  - `mcp_save_config(config: McpConfig)` -> Result
  - `mcp_list_tools(server_name: String)` -> Vec<String>

### Rust: `src-tauri/src/lib.rs`
- Register `mcp` module in Tauri app
- Add `McpManager` to Tauri managed state (`app.manage(mcp_manager)`)
- Setup: load config on startup, auto-start servers marked `enabled = true`
- Teardown: kill all server processes on app close

### Rust: `src-tauri/src/commands/mod.rs`
- Add `pub mod mcp;`

### Rust: `src-tauri/Cargo.toml`
- Add `mcp = { path = "../crates/mcp" }` to dependencies

### TypeScript: `src/types.ts`
- Add types:
  ```ts
  interface McpServerStatus {
    name: string;
    status: 'running' | 'stopped' | 'error';
    error?: string;
    enabled: boolean;
  }
  interface McpConfig {
    servers: McpServerConfig[];
  }
  interface McpServerConfig {
    name: string;
    command: string;
    args: string[];
    env: Record<string, string>;
    enabled: boolean;
  }
  ```

### TypeScript: `src/tauri-bridge.ts`
- Add bridge functions for new commands

### React: `src/components/Titlebar/Titlebar.tsx`
- Add **MCP status button** in `.titlebar__right` next to terminal toggle:
  - Icon: `Cpu` (or `PlugZap`) from lucide-react
  - Colored dot indicator: green (all enabled running), yellow (some stopped), red (all stopped/error), gray (no MCP configured)
  - Click opens MCP status dropdown showing all servers with per-server toggle switches
  - Dropdown has "Open MCP Settings" link at bottom

### React: `src/styles/Titlebar.css`
- Add styles for `.titlebar__mcp` button and dropdown

### React: `src/components/Settings/Settings.tsx`
- Add new tab `"mcp"` in the sidebar:
  - Tab icon: `Cpu`
  - Content:
    - List of configured servers (name, status badge, toggle switch, edit button, delete button)
    - "Add Server" form: name, command, args (tag list), env (key-value pairs), enabled toggle
    - "Open Config File" button
    - Raw config editor (textarea with TOML content, validate on save)
    - Import/Export buttons

### React: `src/styles/Settings.css`
- Add styles for MCP settings panel

### React: `src/components/Titlebar/McpStatusDropdown.tsx`
- New component for the dropdown panel showing servers and their statuses

### Config file: `openvibe.toml`
- Created in project root by default
- Auto-created with empty `[mcp]` section if missing
- Hot-reload on file change (watch via `notify` crate)

## Implementation details

### MCP Protocol
- Transport: stdio (child process stdin/stdout)
- Protocol: JSON-RPC 2.0
- Key methods to support:
  - `initialize` — server capability discovery
  - `tools/list` — discover available tools
  - `tools/call` — invoke a tool
  - `ping` — health check
- Response parsing: read line-delimited JSON from stdout
- Error handling: stderr capture, timeout (5s for init)

### Status indicator logic
```
no servers configured          -> gray dot, no click action
all enabled servers running    -> green dot
some enabled servers stopped   -> yellow dot
all enabled servers stopped    -> red dot
```

### Auto-start behavior
- On app launch, start all servers with `enabled = true`
- Retry logic: 3 attempts with 1s delay
- If server binary not found -> status=Error, user sees in dropdown

## Dependencies to add

### Cargo
- `toml` = "0.8" (deserialize/serialize TOML)
- `serde` with derive
- `serde_json` (JSON-RPC parsing)
- `tokio` with process feature
- `tracing` (logging)

### npm
- Already has `lucide-react` — use `Cpu`, `PlugZap`, `Circle` icons

## Edge cases
- Server process crashes -> auto-restart (max 3 times, then mark Error)
- Config file manually edited while app is open -> hot-reload (debounce 500ms)
- Multiple servers with same name -> validation error on save
- Empty command -> validation error
- Server that hangs on init -> timeout after 10s
- Server that exits immediately -> capture stderr, show as Error
- Platform-specific paths (Windows .exe, PATH resolution)
- Non-UTF8 stderr -> lossy conversion

## Testing
- Unit tests for config parsing (happy path, malformed toml, missing fields)
- Unit tests for status logic
- Integration test: spawn a real MCP echo server, call init, verify response
- Frontend: Vitest tests for McpStatusDropdown rendering
