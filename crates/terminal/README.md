# `terminal` Crate

The `terminal` crate manages interactive shell sessions and terminal processes for OpenVibe. It handles shell executable discovery, asynchronous input/output stream management, session tracking, process cleanup, and IPC events between the application backend and frontend terminal components.

---

## Overview and Key Features

- **Session Management**: `TerminalManager` tracks concurrent active terminal instances (`TerminalSession`) by session ID.
- **Shell Discovery**: Automatically detects available system shells (e.g. bash, zsh, sh, or cmd/PowerShell) via `shell::pick_shell()`.
- **Asynchronous Output Stream Reader**: Streams standard output and standard error from terminal sessions back to UI event listeners.
- **Input Dispatching**: Sends user keystrokes and shell commands (`write`) directly to child shell processes.
- **Lifecycle Control**: Supports explicit session termination (`kill`) and workspace teardown cleanup (`kill_all`).

---

## Architecture and Modules

| Module                                         | Description                                                                                |
| :--------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `manager` ([`src/manager.rs`](src/manager.rs)) | `TerminalManager` managing the session registry map and routing write/kill calls.          |
| `session` ([`src/session.rs`](src/session.rs)) | `TerminalSession` wrapping child process handles, stdin/stdout streams, and exit handlers. |
| `shell` ([`src/shell.rs`](src/shell.rs))       | Shell detection utilities selecting system shell binaries and environment variables.       |

---

## Usage Example

```rust
use terminal::TerminalManager;

fn main() {
    let workspace_cwd = "./";
    let manager = TerminalManager::new(workspace_cwd);

    // Start a terminal session with ID "term-1"
    manager.start(
        "term-1",
        80, // columns
        24, // rows
        |output_chunk| {
            print!("{}", output_chunk);
        },
        |exit_code| {
            println!("Terminal process exited with code: {}", exit_code);
        },
    );

    // Send command to terminal session
    manager.write("term-1", "ls -la\n");

    // Terminate session when finished
    manager.kill("term-1");
}
```

---

## Dependencies

- **External Dependencies**:
  - `serde`, `serde_json` — Session payload serialization.
