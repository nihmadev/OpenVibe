# `db` Crate

The `db` crate serves as the core database access layer for OpenVibe. Built on SQLite using `rusqlite`, it manages application state persistence, including workspace projects (`Project`), configured LLM providers (`Provider`), custom icons, and database connection pools.

---

## Overview and Key Features

- **Entity Management**: Defines and manages domain models for workspace projects (`Project`) and LLM providers (`Provider`).
- **Project Store**: Provides `ProjectStore` for CRUD operations on registered workspace paths, UI colors, icons, and metadata.
- **Provider Store**: Handles persistent storage for custom LLM endpoints, credentials, custom headers, and API parameter configurations.
- **Row Conversion**: Implements efficient `TryFrom<&rusqlite::Row>` traits for strongly-typed database query deserialization.
- **Error Abstraction**: Wraps SQLite database errors into structured `DbError` enums.

---

## Architecture and Modules

| Module                                      | Description                                                                                  |
| :------------------------------------------ | :------------------------------------------------------------------------------------------- |
| `models` ([`src/models.rs`](src/models.rs)) | Defines database models `Project` and `Provider` with SQLite row conversion implementations. |
| `store` ([`src/store/`](src/store))         | Implements persistence interfaces (`ProjectStore`) for SQLite database tables.               |
| `error` ([`src/error.rs`](src/error.rs))    | Defines `DbError` enum using `thiserror`.                                                    |
| `utils` ([`src/utils.rs`](src/utils.rs))    | Database initialization and helper routines.                                                 |

---

## Usage Example

```rust
use db::{ProjectStore, Project};

fn main() -> Result<(), db::DbError> {
    // Initialize or open database store
    let store = ProjectStore::new("openvibe.db")?;

    // Retrieve all workspace projects
    let projects = store.list_projects()?;
    for project in projects {
        println!("Project: {} ({})", project.name, project.path);
    }

    Ok(())
}
```

---

## Dependencies

- **External Dependencies**:
  - `rusqlite` — SQLite driver with bundled static library support.
  - `serde` — Data serialization.
  - `thiserror` — Error handling derivation.
  - `uuid` — Unique identifier generation (v4).
