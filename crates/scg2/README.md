# `scg2` Crate

The `scg2` (Smart Context Generation 2) crate provides code context assembly, AST parsing, dependency graph modeling, recency tracking, and prompt token budget optimization for OpenVibe AI agents. It intelligently extracts and ranks code snippets across the workspace to construct system prompt context for LLM queries.

---

## Overview and Key Features

- **AST Symbol Extraction**: Uses Tree-Sitter parsers to analyze Rust, JavaScript, TypeScript, and Python source files, extracting functions, classes, structs, signatures, and imports.
- **Dependency Graph Modeling**: Builds symbol dependency graphs using `petgraph` (`ContextGraph`) to map references between code files and definitions.
- **Recency Decay Tracking**: Tracks active editor navigation, cursor placements, edits, and file viewing history with time-decay scoring (`RecencyStore`).
- **Git Delta Scoring**: Analyzes recent Git commits and unstaged modifications (`git_delta.rs`) to prioritize recently altered files.
- **Diagnostics Awareness**: Integrates editor diagnostic warnings and compiler errors (`DiagnosticsStore`) into context snippets so the LLM is aware of active build failures.
- **Token Budget Assembly**: Assembles prioritized context snippets (`ContextAssembler`) up to a strict token budget (e.g. 4000 tokens), avoiding prompt overflow.

---

## Architecture and Modules

| Module                                                     | Description                                                                                     |
| :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| `engine` ([`src/engine.rs`](src/engine.rs))                | `Scg2Engine` orchestration engine, background worker loop, and telemetry event consumer.        |
| `ast` ([`src/ast.rs`](src/ast.rs))                         | Tree-Sitter parsing integration (`AstService`) for Rust, JS, TS, and Python grammar trees.      |
| `graph` ([`src/graph.rs`](src/graph.rs))                   | Dependency graph assembly (`ContextGraph`) leveraging `petgraph` directed graphs.               |
| `recency` ([`src/recency.rs`](src/recency.rs))             | Time-decay algorithms (`RecencyStore`) evaluating recently focused and edited files.            |
| `git_delta` ([`src/git_delta.rs`](src/git_delta.rs))       | Git diff prioritization analyzing recent commit history via the `git` crate.                    |
| `diagnostics` ([`src/diagnostics.rs`](src/diagnostics.rs)) | Stores active linter and compiler diagnostics (`EditorDiagnostic`).                             |
| `assembler` ([`src/assembler.rs`](src/assembler.rs))       | `ContextAssembler` selecting and formatting top-ranked code snippets within token limits.       |
| `types` ([`src/types.rs`](src/types.rs))                   | Data types (`ContextSnippet`, `Scg2Config`, `EditorEventBatch`, `CursorPosition`, `LineRange`). |

---

## Usage Example

```rust
use scg2::{Scg2Engine, Scg2Config};

#[tokio::main]
async fn main() {
    // Initialize SCG2 configuration with token limit
    let config = Scg2Config {
        max_context_tokens: 4096,
        recency_weight: 0.4,
        graph_weight: 0.3,
        git_weight: 0.3,
        ..Default::default()
    };

    // Instantiate SCG2 engine
    let engine = Scg2Engine::new(config);

    // Spawn background worker for telemetry and AST updates
    tokio::spawn(async move {
        // engine.start_background_worker().await;
    });

    // Assemble dynamic prompt context for a given active file
    let workspace_path = "./";
    let active_file = "src/main.rs";
    let context = engine.assemble_context(workspace_path, Some(active_file)).await;

    println!("Assembled Context Length: {} chars", context.len());
}
```

---

## Dependencies

- **Internal Workspace Dependencies**:
  - [`git`](../git) — Git delta calculation and change history extraction.
- **External Dependencies**:
  - `tree-sitter`, `tree-sitter-rust`, `tree-sitter-javascript`, `tree-sitter-typescript`, `tree-sitter-python` — Multi-language AST parsing.
  - `petgraph` — Directed dependency graph modeling.
  - `parking_lot` — Fast thread synchronization locks (`Mutex`).
  - `tokio` — Asynchronous channel messaging and background workers.
  - `serde`, `serde_json` — Event and configuration serialization.
