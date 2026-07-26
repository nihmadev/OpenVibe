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

const MAX_RESULTS: usize = 60;

struct ScanOutcome {
    results: Vec<String>,
    skipped_large_files: usize,
    hit_result_cap: bool,
}

/// Walk `root` (a directory OR a single file) and collect matching lines.
/// When `literal` is true the query is matched as a case-insensitive
/// substring; otherwise it is applied as a case-insensitive regex.
fn scan_files(root: &str, query: &str, literal: bool, skip: &[String]) -> ScanOutcome {
    let mut outcome = ScanOutcome {
        results: Vec::new(),
        skipped_large_files: 0,
        hit_result_cap: false,
    };
    let re = if literal {
        None
    } else {
        regex::Regex::new(&format!("(?i){}", query)).ok()
    };
    let q_lower = query.to_lowercase();

    let match_file = |path: &std::path::Path, outcome: &mut ScanOutcome| {
        if let Ok(meta) = std::fs::metadata(path) {
            if meta.len() > MAX_FILE_BYTES {
                outcome.skipped_large_files += 1;
                return;
            }
        }
        let text = match std::fs::read_to_string(path) {
            Ok(t) => t,
            Err(_) => return,
        };
        let path_str = path.to_string_lossy().to_string();
        for (i, line) in text.lines().enumerate() {
            if outcome.results.len() >= MAX_RESULTS {
                outcome.hit_result_cap = true;
                return;
            }
            let matched = if let Some(ref r) = re {
                r.is_match(line)
            } else {
                line.to_lowercase().contains(&q_lower)
            };
            if matched {
                outcome
                    .results
                    .push(format!("{}:{}: {}", path_str, i + 1, line));
            }
        }
    };

    let root_path = std::path::PathBuf::from(root);
    // `root` may point directly at a file — search just that file instead of
    // silently returning nothing (read_dir fails on files).
    if root_path.is_file() {
        match_file(&root_path, &mut outcome);
        return outcome;
    }

    let mut dirs: Vec<std::path::PathBuf> = vec![root_path];
    while let Some(dir) = dirs.pop() {
        if outcome.results.len() >= MAX_RESULTS {
            outcome.hit_result_cap = true;
            break;
        }
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            if outcome.results.len() >= MAX_RESULTS {
                outcome.hit_result_cap = true;
                break;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if skip.iter().any(|s| s == &name) {
                continue;
            }
            if let Ok(ft) = entry.file_type() {
                if ft.is_dir() {
                    dirs.push(entry.path());
                } else if ft.is_file() {
                    match_file(&entry.path(), &mut outcome);
                }
            }
        }
    }
    outcome
}

fn format_scan_output(query: &str, outcome: &ScanOutcome, note: Option<&str>) -> String {
    let mut out = outcome.results.join("\n");
    let mut footers: Vec<String> = Vec::new();
    if outcome.hit_result_cap {
        footers.push(format!(
            "[note: output capped at {MAX_RESULTS} matches; narrow the query or root for full coverage]"
        ));
    }
    if outcome.skipped_large_files > 0 {
        footers.push(format!(
            "[note: {} file(s) over {} KB were skipped]",
            outcome.skipped_large_files,
            MAX_FILE_BYTES / 1024
        ));
    }
    if let Some(n) = note {
        footers.push(n.to_string());
    }
    if !footers.is_empty() {
        out.push('\n');
        out.push_str(&footers.join("\n"));
    }
    if outcome.results.is_empty() {
        format!(
            "No results found for '{query}'{}",
            if footers.is_empty() {
                String::new()
            } else {
                format!("\n{}", footers.join("\n"))
            }
        )
    } else {
        clip(&out, MAX_OUTPUT_CHARS)
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

    if !std::path::Path::new(&resolved_root).exists() {
        return Ok(format!(
            "Search root '{requested_root}' does not exist (resolved: '{resolved_root}'). \
             Check the path with list_dir."
        ));
    }

    let is_regex_query = regex::Regex::new(&format!("(?i){}", query)).is_ok();

    let skip: Vec<String> = [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        "out",
        "target",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();

    let q = query.to_string();
    let root_clone = resolved_root.clone();
    let skip_clone = skip.clone();

    let regex_outcome = tokio::task::spawn_blocking(move || {
        scan_files(&root_clone, &q, !is_regex_query, &skip_clone)
    })
    .await
    .map_err(|e| format!("Search failed: {e}"))?;

    if !regex_outcome.results.is_empty() {
        return Ok(format_scan_output(query, &regex_outcome, None));
    }

    // Regex found nothing: if the query contains regex metacharacters it may
    // have been intended literally (e.g. `check_expr(stmt.value)` or
    // `cname == 'CastExpr'`). Retry as a literal substring before giving up,
    // so escaping mistakes do not produce false "No results".
    let has_meta = query.chars().any(|c| "\\.+*?()|[]{}^$".contains(c));
    if is_regex_query && has_meta {
        let q = query.to_string();
        let root_clone = resolved_root.clone();
        let skip_clone = skip.clone();
        let literal_outcome =
            tokio::task::spawn_blocking(move || scan_files(&root_clone, &q, true, &skip_clone))
                .await
                .map_err(|e| format!("Search failed: {e}"))?;
        if !literal_outcome.results.is_empty() {
            return Ok(format_scan_output(
                query,
                &literal_outcome,
                Some("[note: regex found nothing; showing literal substring matches]"),
            ));
        }
    }

    if is_regex_query {
        return Ok(format_scan_output(query, &regex_outcome, None));
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

    #[tokio::test]
    async fn literal_fallback_finds_code_with_regex_metacharacters() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(
            dir.path().join("checker.py"),
            "t = self.check_expr(stmt.value)\nif cname == 'CastExpr': pass\n",
        )
        .unwrap();

        // As a regex, `check_expr(stmt.value)` means `check_exprstmt.value`
        // (group + `.` wildcard) and never matches the literal source line.
        // The literal fallback must still find it.
        let result = tool_search_codebase(
            dir.path().to_str().unwrap(),
            &serde_json::json!({"query": "check_expr(stmt.value)"}),
        )
        .await
        .unwrap();
        assert!(result.contains("checker.py"), "got: {result}");
        assert!(result.contains("literal substring"), "got: {result}");

        // Quoted alternation used to return false "No results" too.
        let result2 = tool_search_codebase(
            dir.path().to_str().unwrap(),
            &serde_json::json!({"query": "cname == 'CastExpr'"}),
        )
        .await
        .unwrap();
        assert!(result2.contains("checker.py"), "got: {result2}");
    }

    #[tokio::test]
    async fn root_pointing_at_single_file_is_searched() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("only.rs"), "const FILE_PROBE: u8 = 1;\n").unwrap();

        let result = tool_search_codebase(
            dir.path().to_str().unwrap(),
            &serde_json::json!({"query": "FILE_PROBE", "root": "only.rs"}),
        )
        .await
        .unwrap();
        assert!(result.contains("only.rs"), "got: {result}");
    }

    #[tokio::test]
    async fn missing_root_reports_clear_error_instead_of_no_results() {
        let dir = tempfile::tempdir().unwrap();
        let result = tool_search_codebase(
            dir.path().to_str().unwrap(),
            &serde_json::json!({"query": "anything", "root": "does/not/exist"}),
        )
        .await
        .unwrap();
        assert!(result.contains("does not exist"), "got: {result}");
    }

    #[tokio::test]
    async fn skipped_large_files_are_reported() {
        let dir = tempfile::tempdir().unwrap();
        let big = "x".repeat((MAX_FILE_BYTES as usize) + 1);
        std::fs::write(dir.path().join("big.txt"), &big).unwrap();
        std::fs::write(dir.path().join("small.txt"), "needle_here\n").unwrap();

        let result = tool_search_codebase(
            dir.path().to_str().unwrap(),
            &serde_json::json!({"query": "needle_here"}),
        )
        .await
        .unwrap();
        assert!(result.contains("small.txt"), "got: {result}");
        assert!(result.contains("skipped"), "got: {result}");
    }
}
