use std::path::Path;

use crate::config::{MAX_FILE_BYTES, MAX_OUTPUT_CHARS};

fn resolve_path(cwd: &str, p: &str) -> String {
    let path = Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        Path::new(cwd).join(p).to_string_lossy().to_string()
    }
}

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        format!(
            "{}\n…[truncated, {} more chars]",
            &text[..max],
            text.len() - max
        )
    }
}

pub async fn search_content(
    cwd: &str,
    query: &str,
    root: &str,
    max_results: usize,
) -> Result<String, String> {
    let resolved_root = resolve_path(cwd, root);

    let is_regex_query = regex::Regex::new(&format!("(?i){}", query)).is_ok();

    let skip: Vec<String> = crate::config::SKIP_DIRS
        .iter()
        .map(|s| s.to_string())
        .collect();

    let root_clone = resolved_root.clone();
    let q = query.to_string();
    let skip_clone = skip.clone();

    let results = tokio::task::spawn_blocking(move || -> Vec<String> {
        let mut results: Vec<String> = Vec::new();
        let mut dirs: Vec<std::path::PathBuf> = vec![std::path::PathBuf::from(&root_clone)];

        let use_regex = regex::Regex::new(&format!("(?i){}", q)).ok();
        let q_lower = q.to_lowercase();

        while let Some(dir) = dirs.pop() {
            if results.len() >= max_results {
                break;
            }
            let entries = match std::fs::read_dir(&dir) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                if results.len() >= max_results {
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
                            if results.len() >= max_results {
                                break;
                            }
                            let matched = if let Some(ref re) = use_regex {
                                re.is_match(line)
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
    .map_err(|e| format!("Content search failed: {e}"))?;

    if !results.is_empty() || is_regex_query {
        if results.is_empty() {
            return Ok("(no matches)".to_string());
        }
        return Ok(clip(&results.join("\n"), MAX_OUTPUT_CHARS));
    }

    Ok("(no matches)".to_string())
}

pub async fn search_content_with_vector(
    cwd: &str,
    query: &str,
    root: &str,
    max_results: usize,
) -> Result<String, String> {
    let content_result = search_content(cwd, query, root, max_results).await?;

    if content_result != "(no matches)" {
        return Ok(content_result);
    }

    let is_regex = regex::Regex::new(&format!("(?i){}", query)).is_ok();
    if is_regex {
        return Ok("(no matches)".to_string());
    }

    let vec_root = resolve_path(cwd, root);
    let vec_query = query.to_string();
    let additional = tokio::task::spawn_blocking(move || -> Vec<String> {
        match crate::vector_search::search_codebase_vector(&vec_query, &vec_root, max_results) {
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
        return Ok("(no matches)".to_string());
    }

    Ok(clip(&additional.join("\n"), MAX_OUTPUT_CHARS))
}
