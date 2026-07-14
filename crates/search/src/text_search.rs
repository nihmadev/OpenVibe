use std::path::Path;
use crate::config::{MAX_FILE_BYTES, MAX_OUTPUT_CHARS};
use crate::types::{ContentMatch};
use crate::utils::{resolve_path, clip, compile_patterns, matches_any};

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
    let gitignore = crate::gitignore_filter::load(std::path::Path::new(&root_clone));

    let results = tokio::task::spawn_blocking(move || -> Vec<String> {
        let mut results: Vec<String> = Vec::new();

        let use_regex = regex::Regex::new(&format!("(?i){}", q)).ok();
        let q_lower = q.to_lowercase();

        let root_path = std::path::PathBuf::from(&root_clone);
        let walk = jwalk::WalkDir::new(&root_path).process_read_dir(
            move |_depth, _path, _state, children| {
                children.retain(|entry_result| {
                    let entry = match entry_result {
                        Ok(e) => e,
                        Err(_) => return false,
                    };
                    let name = entry.file_name.to_string_lossy().to_string();
                    if skip_clone.iter().any(|s| s == &name) {
                        return false;
                    }
                    if let Some(ref gi) = gitignore {
                        if let Ok(rel) = entry.path().strip_prefix(&root_path) {
                            if crate::gitignore_filter::is_ignored(
                                gi,
                                rel,
                                entry.file_type().is_dir(),
                            ) {
                                return false;
                            }
                        }
                    }
                    true
                });
            },
        );
        for entry in walk.into_iter() {
            if results.len() >= max_results {
                break;
            }
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            if !entry.file_type().is_file() {
                continue;
            }
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
    let skip: Vec<String> = crate::config::SKIP_DIRS
        .iter()
        .map(|s| s.to_string())
        .collect();

    let root_clone = resolved_root.clone();
    let q = query.to_string();
    let skip_clone = skip.clone();
    let include_pats = compile_patterns(include);
    let exclude_pats = compile_patterns(exclude);
    let gitignore = crate::gitignore_filter::load(std::path::Path::new(&root_clone));

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
        let walk = jwalk::WalkDir::new(&root_path).process_read_dir(
            move |_depth, _path, _state, children| {
                children.retain(|entry_result| {
                    let entry = match entry_result {
                        Ok(e) => e,
                        Err(_) => return false,
                    };
                    let name = entry.file_name.to_string_lossy().to_string();
                    if skip_clone.iter().any(|s| s == &name) {
                        return false;
                    }
                    if let Some(ref gi) = gitignore {
                        if let Ok(rel) = entry.path().strip_prefix(&root_path) {
                            if crate::gitignore_filter::is_ignored(
                                gi,
                                rel,
                                entry.file_type().is_dir(),
                            ) {
                                return false;
                            }
                        }
                    }
                    true
                });
            },
        );
        for entry in walk.into_iter() {
            if results.len() >= max_results {
                break;
            }
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            if !entry.file_type().is_file() {
                continue;
            }
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
