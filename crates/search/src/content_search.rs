use std::num::NonZeroUsize;
use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

use lru::LruCache;
use once_cell::sync::Lazy;

use crate::config::{MAX_FILE_BYTES, MAX_OUTPUT_CHARS};
use crate::types::{ContentMatch, FileGroupEntry};

fn resolve_path(cwd: &str, p: &str) -> String {
    let path = Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        Path::new(cwd).join(p).to_string_lossy().to_string()
    }
}

pub fn clip(text: &str, max: usize) -> String {
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

        let use_regex = regex::Regex::new(&format!("(?i){}", q)).ok();
        let q_lower = q.to_lowercase();

        for entry in jwalk::WalkDir::new(&root_clone)
            .into_iter()
            .filter(|e| match e {
                Ok(e) => {
                    let name = e.file_name().to_string_lossy().to_string();
                    !skip_clone.iter().any(|s| s == &name)
                }
                Err(_) => false,
            })
        {
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

fn glob_to_regex(pattern: &str) -> String {
    let owned;
    let p = if pattern.starts_with('.') {
        owned = format!("*{}", pattern);
        &owned
    } else {
        pattern
    };
    let mut re = String::with_capacity(p.len() * 2);
    let mut chars = p.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '*' if chars.peek() == Some(&'*') => {
                chars.next();
                re.push_str(".*");
            }
            '*' => re.push_str(".*"),
            '?' => re.push('.'),
            '.' | '+' | '(' | ')' | '|' | '^' | '$' | '[' | ']' | '{' | '}' | '\\' => {
                re.push('\\');
                re.push(ch);
            }
            _ => re.push(ch),
        }
    }
    re
}

pub fn compile_patterns(patterns: &str) -> Vec<regex::Regex> {
    patterns
        .split(',')
        .map(|p| p.trim())
        .filter(|p| !p.is_empty())
        .filter_map(|p| regex::Regex::new(&glob_to_regex(p)).ok())
        .collect()
}

pub fn matches_any(path: &str, patterns: &[regex::Regex]) -> bool {
    if patterns.is_empty() {
        return true;
    }
    patterns.iter().any(|re| re.is_match(path))
}

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
        let q_lower = if match_case { q.clone() } else { q.to_lowercase() };
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

        for entry in jwalk::WalkDir::new(&root_clone)
            .into_iter()
            .filter(|e| match e {
                Ok(e) => {
                    let name = e.file_name().to_string_lossy().to_string();
                    !skip_clone.iter().any(|s| s == &name)
                }
                Err(_) => false,
            })
        {
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

// ── Search cache for instant re-filter ──

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

    let results = tokio::task::spawn_blocking(move || -> Vec<ContentMatch> {
        let mut results: Vec<ContentMatch> = Vec::new();

        let re_pattern = if use_regex {
            regex::Regex::new(&format!("(?i){}", q)).ok()
        } else {
            None
        };
        let q_lower = q.to_ascii_lowercase();

        for entry in jwalk::WalkDir::new(&root_clone)
            .into_iter()
            .filter(|e| match e {
                Ok(e) => {
                    let name = e.file_name().to_string_lossy().to_string();
                    !skip_clone.iter().any(|s| s == &name)
                }
                Err(_) => false,
            })
        {
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
        if !line_matches(&m.content, query, match_case, query_re.as_ref(), &query_lower) {
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

/// Clear the search cache (e.g. when files change on disk).
// ── Syntax highlighting in Rust ──

fn lang_from_filename(name: &str) -> &str {
    let ext = name.rsplit('.').next().unwrap_or("");
    match ext {
        "ts" | "tsx" | "vue" | "svelte" => "ts",
        "js" | "jsx" | "mjs" | "cjs" => "js",
        "rs" => "rs",
        "py" => "py",
        "go" => "go",
        "java" | "kt" | "scala" => "java",
        _ => "",
    }
}

struct LangDef {
    exts: &'static [&'static str],
    keywords: &'static [&'static str],
}

const LANG_KEYWORDS: &[LangDef] = &[
    LangDef { exts: &["ts", "js"], keywords: &[
        "const", "let", "var", "function", "return", "if", "else", "for", "while",
        "class", "import", "export", "from", "async", "await", "type", "interface",
        "extends", "implements", "new", "this", "throw", "try", "catch", "finally",
        "switch", "case", "default", "break", "continue", "typeof", "instanceof",
        "in", "of", "as", "keyof", "readonly", "static", "private", "protected",
        "public", "abstract", "declare", "delete", "void", "true", "false",
    ]},
    LangDef { exts: &["rs"], keywords: &[
        "fn", "let", "mut", "const", "if", "else", "for", "while", "loop", "return",
        "match", "pub", "use", "mod", "struct", "enum", "impl", "trait", "async",
        "await", "move", "ref", "self", "super", "crate", "where", "type", "dyn",
        "in", "as", "true", "false", "Some", "None", "Ok", "Err", "unsafe", "extern",
        "static", "match",
    ]},
    LangDef { exts: &["py"], keywords: &[
        "def", "class", "return", "if", "elif", "else", "for", "while", "import",
        "from", "as", "with", "try", "except", "finally", "raise", "yield", "lambda",
        "pass", "break", "continue", "and", "or", "not", "in", "is", "True", "False",
        "None", "self", "async", "await",
    ]},
    LangDef { exts: &["go"], keywords: &[
        "func", "return", "if", "else", "for", "range", "switch", "case", "default",
        "break", "continue", "var", "const", "type", "struct", "interface", "import",
        "package", "map", "chan", "go", "defer", "select", "fallthrough",
    ]},
    LangDef { exts: &["java"], keywords: &[
        "public", "private", "protected", "static", "final", "class", "interface",
        "extends", "implements", "return", "if", "else", "for", "while", "do",
        "switch", "case", "default", "break", "continue", "new", "this", "super",
        "import", "package", "void", "int", "boolean", "String", "null", "true",
        "false", "throw", "throws", "try", "catch", "finally",
    ]},
];

fn keywords_for_lang(lang: &str) -> &[&str] {
    for def in LANG_KEYWORDS {
        if def.exts.contains(&lang) {
            return def.keywords;
        }
    }
    &[]
}

/// Tokenize a single line of code into syntax tokens (no query highlighting).
pub fn tokenize_line(line: &str, lang: &str) -> Vec<crate::types::SyntaxToken> {
    let keywords = keywords_for_lang(lang);
    let mut tokens = Vec::new();
    let mut i = 0;
    let bytes = line.as_bytes();
    while i < bytes.len() {
        // Strings
        if i < bytes.len() && (bytes[i] == b'"' || bytes[i] == b'\'' || bytes[i] == b'`') {
            let quote = bytes[i];
            let start = i;
            i += 1;
            while i < bytes.len() && bytes[i] != quote {
                if bytes[i] == b'\\' { i += 1; }
                i += 1;
            }
            if i < bytes.len() { i += 1; }
            tokens.push(crate::types::SyntaxToken {
                text: line[start..i].to_string(),
                class_name: "sc-token-string".to_string(),
            });
            continue;
        }
        // Comments
        if i + 1 < bytes.len() && bytes[i] == b'/' && (bytes[i + 1] == b'/' || bytes[i + 1] == b'*') {
            tokens.push(crate::types::SyntaxToken {
                text: line[i..].to_string(),
                class_name: "sc-token-comment".to_string(),
            });
            break;
        }
        // Numbers
        if bytes[i].is_ascii_digit() {
            let start = i;
            while i < bytes.len() && (bytes[i].is_ascii_digit() || bytes[i] == b'.') { i += 1; }
            tokens.push(crate::types::SyntaxToken {
                text: line[start..i].to_string(),
                class_name: "sc-token-number".to_string(),
            });
            continue;
        }
        // Identifiers / keywords
        if bytes[i].is_ascii_alphabetic() || bytes[i] == b'_' || bytes[i] == b'$' {
            let start = i;
            while i < bytes.len() && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_' || bytes[i] == b'$') {
                i += 1;
            }
            let word = &line[start..i];
            let class = if keywords.contains(&word) { "sc-token-keyword" } else { "sc-token-identifier" };
            tokens.push(crate::types::SyntaxToken {
                text: word.to_string(),
                class_name: class.to_string(),
            });
            continue;
        }
        // Whitespace
        if bytes[i].is_ascii_whitespace() {
            let start = i;
            while i < bytes.len() && bytes[i].is_ascii_whitespace() { i += 1; }
            tokens.push(crate::types::SyntaxToken {
                text: line[start..i].to_string(),
                class_name: "sc-token-ws".to_string(),
            });
            continue;
        }
        // Punctuation / other (handle multi-byte UTF-8)
        let ch = line[i..].chars().next().unwrap_or(std::char::REPLACEMENT_CHARACTER);
        let char_len = ch.len_utf8();
        tokens.push(crate::types::SyntaxToken {
            text: line[i..i + char_len].to_string(),
            class_name: "sc-token-punctuation".to_string(),
        });
        i += char_len;
    }
    tokens
}

/// Tokenize a line and highlight query matches within tokens.
/// Returns (tokens, match_ranges) where match_ranges are byte offset ranges to highlight.
pub fn highlight_line(
    line: &str,
    lang: &str,
    query: &str,
    match_case: bool,
) -> Vec<crate::types::SyntaxToken> {
    let tokens = tokenize_line(line, lang);
    if query.is_empty() {
        return tokens;
    }

    let q = if match_case { query.to_string() } else { query.to_ascii_lowercase() };
    let mut result = Vec::new();

    for token in &tokens {
        let txt = if match_case { &token.text } else { &token.text.to_ascii_lowercase() };
        let mut last = 0usize;
        let mut in_match = false;
        let mut match_started = last;

        // Simple scan through the text for query matches
        let query_bytes = q.as_bytes();
        let text_bytes = txt.as_bytes();
        let mut pos = 0;
        while pos + query_bytes.len() <= text_bytes.len() {
            let matched = if query_bytes.len() == 0 {
                false
            } else {
                &text_bytes[pos..pos + query_bytes.len()] == query_bytes
            };
            if matched {
                if !in_match {
                    // push preceding unmatched part
                    if pos > last {
                        result.push(crate::types::SyntaxToken {
                            text: token.text[last..pos].to_string(),
                            class_name: token.class_name.clone(),
                        });
                    }
                    in_match = true;
                    match_started = pos;
                }
                pos += query_bytes.len();
            } else {
                if in_match {
                    result.push(crate::types::SyntaxToken {
                        text: token.text[match_started..pos].to_string(),
                        class_name: "sc-match-highlight".to_string(),
                    });
                    in_match = false;
                    last = pos;
                }
                pos += 1;
            }
        }
        if in_match {
            result.push(crate::types::SyntaxToken {
                text: token.text[match_started..].to_string(),
                class_name: "sc-match-highlight".to_string(),
            });
        } else if last < token.text.len() {
            result.push(crate::types::SyntaxToken {
                text: token.text[last..].to_string(),
                class_name: token.class_name.clone(),
            });
        }
    }
    result
}

/// Highlight multiple lines in one batch call.
pub fn highlight_lines(
    lines: &[&str],
    file_name: &str,
    query: &str,
    match_case: bool,
) -> Vec<Vec<crate::types::SyntaxToken>> {
    let lang = lang_from_filename(file_name);
    lines.iter().map(|line| highlight_line(line, lang, query, match_case)).collect()
}

pub fn clear_search_cache() {
    if let Ok(mut cache) = SEARCH_CACHE.lock() {
        cache.clear();
    }
}

/// Returns file-level grouping from the broad cache with optional filtering.
/// Avoids sending individual line matches — just paths + counts.
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
        if !line_matches(&m.content, query, match_case, query_re.as_ref(), &query_lower) {
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
        if !line_matches(&m.content, query, match_case, query_re.as_ref(), &query_lower) {
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
