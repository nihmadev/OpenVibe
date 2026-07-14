# `editor` Crate

The `editor` crate provides specialized editor workspace services, type definition preloading, and code intelligence helpers for the OpenVibe frontend editor. It scans node_modules, `.d.ts` declaration files, and project structures to provide TypeScript/JavaScript type preloading and file metadata to the user interface.

---

## Overview and Key Features

- **TypeScript Type Preloading**: Implements `preload_types` to discover, parse, and load `.d.ts` type definition files from project dependencies and `@types` modules.
- **Node Modules Inspection**: Scans workspace `package.json` configurations to locate installed package typings.
- **File System Integration**: Works alongside the `search` crate to collect workspace file paths safely while respecting file size limits (e.g., max 2MB per type file).
- **Frontend Serialization**: Exposes `PreloadTypesResult`, `TypeFile`, and `PackageTypeInfo` with camelCase JSON serialization for seamless consumption by Monaco/VS Code web editor instances.

---

## Architecture and Modules

| Module                                | Description                                                                                                                         |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------- |
| `lib.rs` ([`src/lib.rs`](src/lib.rs)) | Contains main type scanning logic (`preload_types`), `.d.ts` collector algorithms, package.json parsing, and JSON type definitions. |

---

## Usage Example

```rust
use editor::preload_types;

fn main() {
    let workspace_path = "./";

    match preload_types(workspace_path) {
        Ok(type_info) => {
            println!("Preloaded {} custom type files", type_info.types.len());
            println!("Discovered {} package typings", type_info.packages.len());
        }
        Err(err) => {
            eprintln!("Failed to preload workspace types: {}", err);
        }
    }
}
```

---

## Dependencies

- **Internal Workspace Dependencies**:
  - [`search`](../search) — File directory walking utilities (`walker`).
- **External Dependencies**:
  - `serde`, `serde_json` — Struct serialization for frontend editor state.
