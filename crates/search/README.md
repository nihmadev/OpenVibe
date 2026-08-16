# `search` Crate

The `search` crate provides full-text regex matching, high-performance file tree traversal, LRU search caching, and syntax tokenization for OpenVibe.

---

## Overview and Key Features

- **High-Performance Directory Walker**: Uses `jwalk` and `ignore` crates for parallel file system traversal while respecting `.gitignore` rules, hidden files, and file size limits.
- **Full-Text Regex Search**: Performs substring and regular expression searches across workspace files (`search_content`, `search_content_structured`).
- **LRU Search Caching**: Caches search results and file groups using `lru` to optimize repeated query performance (`ensure_cached`).
- **Syntax Tokenization & Highlighting**: Tokenizes source code lines for inline UI highlighting (`highlight_lines`, `tokenize_line`).

---

## Architecture and Modules

| Module                                                                    | Description                                                                                       |
| :------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------ |
| `text_search` ([`src/text_search.rs`](src/text_search.rs))                | Text and regular expression content matching across workspace files.                              |
| `walker` ([`src/walker.rs`](src/walker.rs))                               | Parallel directory walker (`find_files`, `find_all`) leveraging `jwalk`.                          |
| `cache` ([`src/cache.rs`](src/cache.rs))                                  | Search result caching (`file_matches_from_cache`, `clear_search_cache`).                          |
| `syntax` ([`src/syntax.rs`](src/syntax.rs))                               | Syntax highlighting and token generation (`SyntaxToken`).                                         |
| `gitignore_filter` ([`src/gitignore_filter.rs`](src/gitignore_filter.rs)) | `.gitignore` rules parsing and path filtering.                                                    |
| `commands` ([`src/commands.rs`](src/commands.rs))                         | High-level search command entry points.                                                           |
| `config` ([`src/config.rs`](src/config.rs))                               | File size thresholds (`MAX_FILE_BYTES`) and skip rules.                                           |
| `types` ([`src/types.rs`](src/types.rs))                                  | Data structures (`SearchResult`, `FileMatch`, `ContentMatch`, `FsEntry`, `SyntaxToken`).          |
| `utils` ([`src/utils.rs`](src/utils.rs))                                  | Glob-to-regex transformation and text clipping helpers.                                           |

---

## Usage Example

```rust
use search::search_content;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let workspace_root = "./";

    // Perform text regex search
    let text_results = search_content(workspace_root, "fn main", None, 30).await?;
    println!("Text search matches: {}", text_results);

    Ok(())
}
```

---

## Dependencies

- **External Dependencies**:
  - `jwalk` — Parallel directory traversal.
  - `ignore` — Gitignore parsing and filtering.
  - `regex` — Regular expression processing.
  - `lru` — Least Recently Used caching.
  - `serde`, `serde_json` — Struct serialization.
