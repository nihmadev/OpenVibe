use std::path::Path;

const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_OUTPUT_CHARS: usize = 16_000;

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        let mut end = max;
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        format!(
            "{}\n…[truncated, {} more chars]",
            &text[..end],
            text.len() - max
        )
    }
}

fn resolve_path(cwd: &str, p: &str) -> String {
    let path = Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        Path::new(cwd).join(p).to_string_lossy().to_string()
    }
}

pub async fn tool_search_codebase(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'query' argument".to_string())?;
    let workspace_root = if cwd.is_empty() { "." } else { cwd };
    let requested_root = args.get("root").and_then(|v| v.as_str()).unwrap_or(".");
    let resolved_root = resolve_path(workspace_root, requested_root);

    let is_regex_query = regex::Regex::new(&format!("(?i){}", query)).is_ok();

    let skip: &[&str] = &["node_modules", ".git", "dist", "build", ".next", "out"];

    let q = query.to_string();
    let skip_clone: Vec<String> = skip.iter().map(|s| s.to_string()).collect();
    let root_clone = resolved_root.clone();

    let regex_results = tokio::task::spawn_blocking(move || -> Vec<String> {
        let mut results: Vec<String> = Vec::new();
        let mut dirs: Vec<std::path::PathBuf> = vec![std::path::PathBuf::from(&root_clone)];
        let re = regex::Regex::new(&format!("(?i){}", q)).ok();
        let q_lower = q.to_lowercase();

        while let Some(dir) = dirs.pop() {
            if results.len() >= 30 {
                break;
            }
            let entries = match std::fs::read_dir(&dir) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                if results.len() >= 30 {
                    break;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                if skip_clone.iter().any(|s| s == &name) {
                    continue;
                }
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        dirs.push(entry.path());
                    } else if ft.is_file() {
                        if let Ok(meta) = entry.metadata() {
                            if meta.len() > MAX_FILE_BYTES {
                                continue;
                            }
                        }
                        let path = entry.path();
                        let text = match std::fs::read_to_string(&path) {
                            Ok(t) => t,
                            Err(_) => continue,
                        };
                        let path_str = path.to_string_lossy().to_string();
                        for (i, line) in text.lines().enumerate() {
                            if results.len() >= 30 {
                                break;
                            }
                            let matched = if let Some(ref r) = re {
                                r.is_match(line)
                            } else {
                                line.to_lowercase().contains(&q_lower)
                            };
                            if matched {
                                results.push(format!("{}:{}: {}", path_str, i + 1, line));
                            }
                        }
                    }
                }
            }
        }
        results
    })
    .await
    .map_err(|e| format!("Search failed: {e}"))?;

    if !regex_results.is_empty() || is_regex_query {
        if regex_results.is_empty() {
            return Ok(format!("No results found for '{query}'"));
        }
        return Ok(clip(&regex_results.join("\n"), MAX_OUTPUT_CHARS));
    }

    let vec_root = resolved_root.clone();
    let vec_query = query.to_string();
    let additional = tokio::task::spawn_blocking(move || -> Vec<String> {
        match search::vector_search::search_codebase_vector(&vec_query, &vec_root, 30) {
            Ok(results) => results
                .into_iter()
                .map(|r| {
                    format!(
                        "{}:{}: {} [score={:.3}]",
                        r.path, r.line, r.content, r.score
                    )
                })
                .collect(),
            Err(e) => {
                eprintln!("Vector search error: {e}");
                Vec::new()
            }
        }
    })
    .await
    .map_err(|e| format!("Vector search failed: {e}"))?;

    if additional.is_empty() {
        return Ok(format!("No results found for '{query}'"));
    }

    Ok(clip(&additional.join("\n"), MAX_OUTPUT_CHARS))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn root_restricts_search_to_requested_directory() {
        let dir = tempfile::tempdir().unwrap();
        let scoped = dir.path().join("crates/git");
        let unrelated = dir.path().join("src");
        std::fs::create_dir_all(&scoped).unwrap();
        std::fs::create_dir_all(&unrelated).unwrap();
        std::fs::write(scoped.join("lib.rs"), "const SCOPE_PROBE: bool = true;\n").unwrap();
        std::fs::write(
            unrelated.join("frontend.ts"),
            "const SCOPE_PROBE = false;\n",
        )
        .unwrap();

        let result = tool_search_codebase(
            dir.path().to_str().unwrap(),
            &serde_json::json!({"query": "SCOPE_PROBE", "root": "crates/git"}),
        )
        .await
        .unwrap();

        assert!(result.contains("crates/git"));
        assert!(!result.contains("frontend.ts"));
    }
}
