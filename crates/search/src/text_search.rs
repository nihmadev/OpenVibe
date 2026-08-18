use crate::config::{MAX_FILE_BYTES, MAX_OUTPUT_CHARS};
use crate::types::ContentMatch;
use crate::utils::{clip, compile_patterns, matches_any, resolve_path};
use std::path::Path;

pub async fn search_content(
    cwd: &str,
    query: &str,
    root: &str,
    max_results: usize,
) -> Result<String, String> {
    let resolved_root = resolve_path(cwd, root);

    let is_regex_query = regex::Regex::new(&format!("(?i){}", query)).is_ok();

    let root_clone = resolved_root.clone();
    let q = query.to_string();

    let results = tokio::task::spawn_blocking(move || -> Vec<String> {
        let mut results: Vec<String> = Vec::new();

        let use_regex = regex::Regex::new(&format!("(?i){}", q)).ok();
        let q_lower = q.to_lowercase();

        let root_path = std::path::PathBuf::from(&root_clone);
        for path in workspace_fs::walk_files(&root_path, usize::MAX) {
            if results.len() >= max_results {
                break;
            }
            if let Ok(meta) = path.metadata() {
                if meta.len() > MAX_FILE_BYTES {
                    continue;
                }
            }
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

#[allow(clippy::too_many_arguments)]
pub async fn search_content_structured(
    cwd: &str,
    query: &str,
    root: &str,
    max_results: usize,
    match_case: bool,
    match_whole_word: bool,
    use_regex: bool,
    include: &str,
    exclude: &str,
) -> Result<Vec<ContentMatch>, String> {
    let resolved_root = resolve_path(cwd, root);
    let root_clone = resolved_root.clone();
    let q = query.to_string();
    let include_pats = compile_patterns(include);
    let exclude_pats = compile_patterns(exclude);

    let results = tokio::task::spawn_blocking(move || -> Vec<ContentMatch> {
        let mut results: Vec<ContentMatch> = Vec::new();

        let re_pattern = if use_regex {
            let pattern = if match_case {
                q.clone()
            } else {
                format!("(?i){}", q)
            };
            regex::Regex::new(&pattern).ok()
        } else {
            None
        };
        let q_lower = if match_case {
            q.clone()
        } else {
            q.to_lowercase()
        };
        let whole_word_re = if match_whole_word {
            let word_pattern = if match_case {
                format!(r"\b{}\b", regex::escape(&q))
            } else {
                format!(r"(?i)\b{}\b", regex::escape(&q))
            };
            regex::Regex::new(&word_pattern).ok()
        } else {
            None
        };

        let root_path = std::path::PathBuf::from(&root_clone);
        for path in workspace_fs::walk_files(&root_path, usize::MAX) {
            if results.len() >= max_results {
                break;
            }
            if let Ok(meta) = path.metadata() {
                if meta.len() > MAX_FILE_BYTES {
                    continue;
                }
            }
            let text = match std::fs::read_to_string(&path) {
                Ok(t) => t,
                Err(_) => continue,
            };
            let path_str = path.to_string_lossy().to_string();
            let rel = path_str
                .strip_prefix(&format!("{}/", root_clone))
                .or_else(|| path_str.strip_prefix(&root_clone))
                .unwrap_or(&path_str)
                .to_string();

            if !matches_any(&rel, &include_pats) {
                continue;
            }
            if !exclude_pats.is_empty() && matches_any(&rel, &exclude_pats) {
                continue;
            }

            let file_name = Path::new(&path_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path_str.clone());

            for (i, line) in text.lines().enumerate() {
                if results.len() >= max_results {
                    break;
                }
                let matched = if let Some(ref re) = re_pattern {
                    re.is_match(line)
                } else {
                    let check_line = if match_case {
                        line.to_string()
                    } else {
                        line.to_lowercase()
                    };
                    if match_whole_word {
                        whole_word_re
                            .as_ref()
                            .map(|re| re.is_match(line))
                            .unwrap_or(false)
                    } else {
                        check_line.contains(&q_lower)
                    }
                };
                if matched {
                    let col = if let Some(ref re) = re_pattern {
                        re.find(line).map(|m| m.start() + 1).unwrap_or(1)
                    } else if use_regex {
                        1
                    } else {
                        let search_in = if match_case {
                            line
                        } else {
                            &line.to_lowercase()
                        };
                        search_in.find(&q_lower).map(|c| c + 1).unwrap_or(1)
                    };
                    results.push(ContentMatch {
                        path: path_str.clone(),
                        rel: rel.clone(),
                        name: file_name.clone(),
                        line: i + 1,
                        column: col,
                        content: line.to_string(),
                    });
                }
            }
        }
        results
    })
    .await
    .map_err(|e| format!("Content search failed: {e}"))?;

    Ok(results)
}
