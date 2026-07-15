use crate::config::MAX_FILE_BYTES;
use crate::types::{ContentMatch, FileGroupEntry};
use crate::utils::{compile_patterns, matches_any, resolve_path};
use lru::LruCache;
use once_cell::sync::Lazy;
use std::num::NonZeroUsize;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

struct SearchCacheEntry {
    matches: Vec<ContentMatch>,
    #[allow(dead_code)]
    created_at: Instant,
}

static SEARCH_CACHE: Lazy<Mutex<LruCache<String, SearchCacheEntry>>> =
    Lazy::new(|| Mutex::new(LruCache::new(NonZeroUsize::new(50).unwrap())));

const CACHE_MAX: usize = 200_000;

fn cache_key(resolved_root: &str, query: &str, use_regex: bool) -> String {
    format!("{}\x00{}\x00{}", resolved_root, query, use_regex)
}

/// Compile a query into a regex once, so callers don't recompile per match.
fn compile_query_pattern(
    query: &str,
    match_case: bool,
    use_regex: bool,
    match_whole_word: bool,
) -> Option<regex::Regex> {
    if use_regex {
        let pattern = if match_case {
            query.to_string()
        } else {
            format!("(?i){}", query)
        };
        regex::Regex::new(&pattern).ok()
    } else if match_whole_word {
        let pattern = if match_case {
            format!(r"\b{}\b", regex::escape(query))
        } else {
            format!(r"(?i)\b{}\b", regex::escape(query))
        };
        regex::Regex::new(&pattern).ok()
    } else {
        None
    }
}

/// Check if a line matches query under given filter settings (in-memory, no I/O).
/// Takes a pre-compiled regex and pre-lowercased query to avoid re-computation per line.
fn line_matches(
    line: &str,
    query: &str,
    match_case: bool,
    compiled_regex: Option<&regex::Regex>,
    query_lower: &str,
) -> bool {
    if let Some(re) = compiled_regex {
        re.is_match(line)
    } else if match_case {
        line.contains(query)
    } else {
        line.to_ascii_lowercase().contains(query_lower)
    }
}

/// Run a search with BROAD settings (case-insensitive, no whole-word, no include/exclude)
/// and store results in the global cache. Returns the raw cached matches.
pub async fn ensure_cached(
    cwd: &str,
    query: &str,
    root: &str,
    use_regex: bool,
) -> Result<Vec<ContentMatch>, String> {
    let resolved_root = resolve_path(cwd, root);
    let key = cache_key(&resolved_root, query, use_regex);

    // Fast path: already cached
    {
        let mut cache = SEARCH_CACHE.lock().unwrap();
        if let Some(entry) = cache.get(&key) {
            return Ok(entry.matches.clone());
        }
    }

    // Cache miss: run broad search (match_case=false, whole_word=false, no filters)
    let skip: Vec<String> = crate::config::SKIP_DIRS
        .iter()
        .map(|s| s.to_string())
        .collect();

    let root_clone = resolved_root.clone();
    let q = query.to_string();
    let skip_clone = skip.clone();
    let gitignore = crate::gitignore_filter::load(std::path::Path::new(&root_clone));

    let results = tokio::task::spawn_blocking(move || -> Vec<ContentMatch> {
        let mut results: Vec<ContentMatch> = Vec::new();

        let re_pattern = if use_regex {
            regex::Regex::new(&format!("(?i){}", q)).ok()
        } else {
            None
        };
        let q_lower = q.to_ascii_lowercase();

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
            if results.len() >= CACHE_MAX {
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

            let file_name = Path::new(&path_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path_str.clone());

            for (i, line) in text.lines().enumerate() {
                if results.len() >= CACHE_MAX {
                    break;
                }
                let matched = if let Some(ref re) = re_pattern {
                    re.is_match(line)
                } else {
                    line.to_ascii_lowercase().contains(&q_lower)
                };
                if matched {
                    let col = if let Some(ref re) = re_pattern {
                        re.find(line).map(|m| m.start() + 1).unwrap_or(1)
                    } else {
                        line.to_ascii_lowercase()
                            .find(&q_lower)
                            .map(|c| c + 1)
                            .unwrap_or(1)
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

    // Store in cache (LruCache handles eviction)
    {
        let mut cache = SEARCH_CACHE.lock().unwrap();
        cache.put(
            key,
            SearchCacheEntry {
                matches: results.clone(),
                created_at: Instant::now(),
            },
        );
    }

    Ok(results)
}

/// Filter from the global cache by match_case, whole_word, include, exclude.
/// Returns (total_matches, page_of_results).
#[allow(clippy::too_many_arguments)]
pub fn filter_cached(
    cwd: &str,
    query: &str,
    root: &str,
    use_regex: bool,
    match_case: bool,
    match_whole_word: bool,
    include: &str,
    exclude: &str,
    offset: usize,
    limit: usize,
) -> Result<(usize, Vec<ContentMatch>), String> {
    let resolved_root = resolve_path(cwd, root);
    let key = cache_key(&resolved_root, query, use_regex);

    let mut cache = SEARCH_CACHE
        .lock()
        .map_err(|e| format!("Cache lock: {e}"))?;
    let entry = cache
        .get(&key)
        .ok_or_else(|| "No cached search found. Run a search first.".to_string())?;

    let include_pats = compile_patterns(include);
    let exclude_pats = compile_patterns(exclude);
    let query_re = compile_query_pattern(query, match_case, use_regex, match_whole_word);
    let query_lower = query.to_ascii_lowercase();

    // Two-pass: count total with refs first, then collect only the page
    let predicate = |m: &ContentMatch| -> bool {
        if !matches_any(&m.rel, &include_pats) {
            return false;
        }
        if !exclude_pats.is_empty() && matches_any(&m.rel, &exclude_pats) {
            return false;
        }
        if !line_matches(
            &m.content,
            query,
            match_case,
            query_re.as_ref(),
            &query_lower,
        ) {
            return false;
        }
        true
    };

    let total = entry.matches.iter().filter(|m| predicate(m)).count();
    let page: Vec<ContentMatch> = entry
        .matches
        .iter()
        .filter(|m| predicate(m))
        .skip(offset)
        .take(limit)
        .cloned()
        .collect();

    Ok((total, page))
}
pub fn clear_search_cache() {
    if let Ok(mut cache) = SEARCH_CACHE.lock() {
        cache.clear();
    }
}

/// Returns file-level grouping from the broad cache with optional filtering.
/// Avoids sending individual line matches — just paths + counts.
#[allow(clippy::too_many_arguments)]
pub fn file_groups_from_cache(
    cwd: &str,
    query: &str,
    root: &str,
    use_regex: bool,
    match_case: bool,
    match_whole_word: bool,
    include: &str,
    exclude: &str,
    max_files: usize,
) -> Result<(Vec<FileGroupEntry>, usize), String> {
    let resolved_root = resolve_path(cwd, root);
    let key = cache_key(&resolved_root, query, use_regex);

    let mut cache = SEARCH_CACHE
        .lock()
        .map_err(|e| format!("Cache lock: {e}"))?;
    let entry = cache
        .get(&key)
        .ok_or_else(|| "No cached search found".to_string())?;

    let include_pats = compile_patterns(include);
    let exclude_pats = compile_patterns(exclude);
    let query_re = compile_query_pattern(query, match_case, use_regex, match_whole_word);
    let query_lower = query.to_ascii_lowercase();

    let mut file_map: std::collections::HashMap<String, (String, String, usize)> =
        std::collections::HashMap::new(); // path -> (rel, name, count)
    let mut total = 0usize;

    for m in &entry.matches {
        if !matches_any(&m.rel, &include_pats) {
            continue;
        }
        if !exclude_pats.is_empty() && matches_any(&m.rel, &exclude_pats) {
            continue;
        }
        if !line_matches(
            &m.content,
            query,
            match_case,
            query_re.as_ref(),
            &query_lower,
        ) {
            continue;
        }
        let count = file_map
            .entry(m.path.clone())
            .or_insert_with(|| (m.rel.clone(), m.name.clone(), 0));
        count.2 += 1;
        total += 1;
    }

    let mut groups: Vec<FileGroupEntry> = file_map
        .into_iter()
        .map(|(path, (rel, name, count))| FileGroupEntry {
            path,
            rel,
            name,
            match_count: count,
        })
        .collect();

    groups.sort_by(|a, b| {
        let key_a = format!("{}{}", a.rel.to_lowercase(), a.name.to_lowercase());
        let key_b = format!("{}{}", b.rel.to_lowercase(), b.name.to_lowercase());
        key_a.cmp(&key_b)
    });

    if groups.len() > max_files {
        groups.truncate(max_files);
    }

    Ok((groups, total))
}

/// Returns matches for a single file from the broad cache with pagination.
#[allow(clippy::too_many_arguments)]
pub fn file_matches_from_cache(
    cwd: &str,
    query: &str,
    root: &str,
    use_regex: bool,
    match_case: bool,
    match_whole_word: bool,
    include: &str,
    exclude: &str,
    file_path: &str,
    offset: usize,
    limit: usize,
) -> Result<(Vec<ContentMatch>, usize), String> {
    let resolved_root = resolve_path(cwd, root);
    let key = cache_key(&resolved_root, query, use_regex);

    let mut cache = SEARCH_CACHE
        .lock()
        .map_err(|e| format!("Cache lock: {e}"))?;
    let entry = cache
        .get(&key)
        .ok_or_else(|| "No cached search found".to_string())?;

    let include_pats = compile_patterns(include);
    let exclude_pats = compile_patterns(exclude);
    let query_re = compile_query_pattern(query, match_case, use_regex, match_whole_word);
    let query_lower = query.to_ascii_lowercase();

    let predicate = |m: &ContentMatch| -> bool {
        if m.path != file_path {
            return false;
        }
        if !matches_any(&m.rel, &include_pats) {
            return false;
        }
        if !exclude_pats.is_empty() && matches_any(&m.rel, &exclude_pats) {
            return false;
        }
        if !line_matches(
            &m.content,
            query,
            match_case,
            query_re.as_ref(),
            &query_lower,
        ) {
            return false;
        }
        true
    };

    let total = entry.matches.iter().filter(|m| predicate(m)).count();
    let page: Vec<ContentMatch> = entry
        .matches
        .iter()
        .filter(|m| predicate(m))
        .skip(offset)
        .take(limit)
        .cloned()
        .collect();
    Ok((page, total))
}
