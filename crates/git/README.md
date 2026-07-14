# `git` Crate

The `git` crate provides native Git repository integration for OpenVibe. Leveraging `git2` (bindings to `libgit2`), it performs high-performance repository discovery, status inspection, diff generation, commit history querying, and branch operations without spawning external subprocesses.

---

## Overview and Key Features

- **Repository Discovery**: Locate Git repositories across parent path hierarchies (`is_repository`, `discover`).
- **Status Queries**: Inspect modified, untracked, staged, and deleted workspace files.
- **Diff Generation**: Compute file-level and line-level diffs against staging, working directory, or specific commits.
- **Commit History**: Query commit logs, authors, timestamps, and commit message metadata.
- **Error Abstraction**: Wraps `git2::Error` into structured `GitError` types (`NotFound`, `Git2`).

---

## Architecture and Modules

| Module | Description |
| :--- | :--- |
| `repository` ([`src/repository.rs`](src/repository.rs)) | High-level repository wrapper routines and workspace branch information. |
| `status` ([`src/status.rs`](src/status.rs)) | Git status collection, categorizing modified, untracked, and deleted files. |
| `diff` ([`src/diff.rs`](src/diff.rs)) | Unified diff calculation and line patch formatting. |
| `commit` ([`src/commit.rs`](src/commit.rs)) | Commit operations and commit detail extraction. |
| `history` ([`src/history.rs`](src/history.rs)) | Log traversal and historical revision queries. |
| `error` ([`src/error.rs`](src/error.rs)) | Custom `GitError` enum and result types. |

---

## Usage Example

```rust
use git::{is_repository, get_status};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let repo_path = "./";

    if is_repository(repo_path) {
        let status = get_status(repo_path)?;
        println!("Staged files: {}", status.staged.len());
        println!("Modified files: {}", status.modified.len());
        println!("Untracked files: {}", status.untracked.len());
    } else {
        println!("Path is not a Git repository");
    }

    Ok(())
}
```

---

## Dependencies

- **External Dependencies**:
  - `git2` — Rust bindings to libgit2 C library.
  - `serde`, `serde_json` — Data serialization for UI status presentation.
