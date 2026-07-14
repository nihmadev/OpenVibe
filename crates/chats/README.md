# `chats` Crate

The `chats` crate handles persistent storage, retrieval, and schema migrations for conversation sessions within the OpenVibe ecosystem. Built on top of SQLite (`rusqlite`), it manages user-agent chat histories, session metadata, and message serialization.

---

## Overview and Key Features

- **SQLite History Storage**: Provides durable persistence for chat sessions, messages, and timestamps.
- **Session Summaries**: Efficiently lists chat sessions with metadata (`ChatSummary`) without loading full message arrays into memory.
- **Full Conversation Hydration**: Retrieves complete chat sessions (`ChatRecord`) alongside serialized message objects (`ChatMessage`).
- **Automated Database Migrations**: Manages SQLite table creation and schema updates through `migration.rs`.
- **Integrity & Utilities**: Includes utility functions for timestamp generation (`chrono_now`) and unique ID suffix generation (`rand_suffix`).

---

## Architecture and Modules

| Module | Description |
| :--- | :--- |
| `store` ([`src/store.rs`](src/store.rs)) | Implements `ChatStore`, providing methods to create, update, fetch, and delete chat records in SQLite. |
| `types` ([`src/types.rs`](src/types.rs)) | Defines core data structures `ChatSummary` and `ChatRecord`. |
| `migration` ([`src/migration.rs`](src/migration.rs)) | Handles database schema initialisation and migration scripts. |
| `utils` ([`src/utils.rs`](src/utils.rs)) | Contains timestamp and random string generation helper routines. |

---

## Usage Example

```rust
use chats::ChatStore;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Open or create a SQLite chat database
    let store = ChatStore::new("chats.db")?;

    // Fetch summaries of all saved conversations
    let summaries = store.list_chats()?;
    for summary in summaries {
        println!("Chat ID: {}, Title: {}, Messages: {}", summary.id, summary.title, summary.message_count);
    }

    Ok(())
}
```

---

## Dependencies

- **Internal Workspace Dependencies**:
  - [`agent`](../agent) — Provides `ChatMessage` data models.
- **External Dependencies**:
  - `rusqlite` — SQLite database driver with bundled SQLite engine.
  - `serde`, `serde_json` — Data serialization.
