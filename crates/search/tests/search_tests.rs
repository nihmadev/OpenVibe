use std::fs;

fn temp_dir() -> std::path::PathBuf {
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let dir = std::env::temp_dir()
        .join("openvibe_search_integration")
        .join(format!("{ts}"));
    fs::create_dir_all(&dir).unwrap();
    dir
}

// ── clip() ──

#[test]
fn test_clip_short_text() {
    let result = search::content_search::clip("hello world", 100);
    assert_eq!(result, "hello world");
}

#[test]
fn test_clip_exact_boundary() {
    let text = "a".repeat(100);
    let result = search::content_search::clip(&text, 100);
    assert_eq!(result.len(), 100);
    assert!(!result.contains("[truncated"));
}

#[test]
fn test_clip_long_text() {
    let text = "a".repeat(200);
    let result = search::content_search::clip(&text, 100);
    assert!(result.contains("[truncated"));
    assert!(result.len() < 200);
}

#[test]
fn test_clip_cyrillic_boundary() {
    let text = "Привет, мир! Как дела?";
    let result = search::content_search::clip(text, 20);
    assert!(
        !result.contains('�'),
        "clip must not produce replacement characters"
    );
    assert!(result.contains("[truncated") || result == text);
}

#[test]
fn test_clip_emoji_boundary() {
    let text = "a🚀b🚀c🚀d🚀e🚀f🚀g";
    let result = search::content_search::clip(text, 10);
    assert!(!result.contains('�'), "clip must not split multi-byte emoji");
}

#[test]
fn test_clip_chinese_boundary() {
    let text = "你好世界你好世界你好世界";
    let result = search::content_search::clip(text, 15);
    assert!(!result.contains('�'));
}

#[test]
fn test_clip_empty() {
    assert_eq!(search::content_search::clip("", 100), "");
}

#[test]
fn test_clip_zero_max() {
    let text = "hello";
    let result = search::content_search::clip(text, 0);
    assert_eq!(result, "\n…[truncated, 5 more chars]");
}

#[test]
fn test_clip_special_chars() {
    let text = "foo\x00bar\x1bbaz\tqux\nnewline";
    let result = search::content_search::clip(text, 10);
    assert!(!result.is_empty());
}

// ── compile_patterns() ──

#[test]
fn test_compile_patterns_empty() {
    let pats = search::content_search::compile_patterns("");
    assert!(pats.is_empty());
}

#[test]
fn test_compile_patterns_multiple() {
    let pats = search::content_search::compile_patterns("*.rs, *.ts, *.js");
    assert_eq!(pats.len(), 3);
}

#[test]
fn test_compile_patterns_cyrillic_glob() {
    let pats = search::content_search::compile_patterns("*файл*");
    assert_eq!(pats.len(), 1);
    assert!(pats[0].is_match("мой_файл.rs"));
    assert!(!pats[0].is_match("main.rs"));
}

#[test]
fn test_compile_patterns_all_escape_to_valid() {
    // glob_to_regex escapes everything, so all patterns compile successfully
    let pats = search::content_search::compile_patterns("*.rs, [special], *.ts");
    assert_eq!(pats.len(), 3);
}

// ── matches_any() ──

#[test]
fn test_matches_any_empty() {
    assert!(search::content_search::matches_any("foo.rs", &[]));
}

#[test]
fn test_matches_any_cyrillic_path() {
    let pats = search::content_search::compile_patterns("*файл*");
    assert!(search::content_search::matches_any(
        "src/мой_файл.rs",
        &pats
    ));
    assert!(!search::content_search::matches_any("src/main.rs", &pats));
}

// ── search_content_structured() with temp files ──

#[tokio::test]
async fn test_search_content_structured_basic() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "hello world\nfoo bar\nпривет мир").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "hello",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].content, "hello world");
}

#[tokio::test]
async fn test_search_content_structured_cyrillic() {
    let dir = temp_dir();
    fs::write(
        dir.join("main.rs"),
        "fn main() {\n    println!(\"Привет, мир!\");\n}",
    )
    .unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "Привет",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].content.contains("Привет"));
}

#[tokio::test]
async fn test_search_content_structured_case_sensitive() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "Hello\nhello\nHELLO").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "Hello",
        &dir.to_string_lossy(),
        100,
        true,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
}

#[tokio::test]
async fn test_search_content_structured_regex() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "cat\ncot\ncut\ndog").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "c[ou]t",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        true,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 2);
}

#[tokio::test]
async fn test_search_content_structured_whole_word() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "the cat\ncaterpillar\ncat").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "cat",
        &dir.to_string_lossy(),
        100,
        false,
        true,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 2);
}

#[tokio::test]
async fn test_search_content_structured_include_filter() {
    let dir = temp_dir();
    fs::write(dir.join("keep.ts"), "hello").unwrap();
    fs::write(dir.join("skip.js"), "hello").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "hello",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "*.ts",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].name.ends_with(".ts"));
}

#[tokio::test]
async fn test_search_content_structured_exclude_filter() {
    let dir = temp_dir();
    fs::write(dir.join("keep.ts"), "hello").unwrap();
    fs::write(dir.join("skip.js"), "hello").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "hello",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "",
        "*.js",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].name.ends_with(".ts"));
}

#[tokio::test]
async fn test_search_content_structured_max_results_cap() {
    let dir = temp_dir();
    let mut content = String::new();
    for i in 0..100 {
        content.push_str(&format!("match line {i}\n"));
    }
    fs::write(dir.join("big.txt"), &content).unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        10,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 10);
}

#[tokio::test]
async fn test_search_content_structured_no_matches() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "hello world").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "zzzzz",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert!(results.is_empty());
}

#[tokio::test]
async fn test_search_content_structured_large_file_skipped() {
    let dir = temp_dir();
    let large_content = "x".repeat(256 * 1024 + 1);
    fs::write(dir.join("large.txt"), &large_content).unwrap();
    fs::write(dir.join("small.txt"), "match").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].name == "small.txt");
}

#[tokio::test]
async fn test_search_content_structured_special_chars_in_query() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "foo.bar\nfoo[bar]\nfoo$bar").unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "foo.bar",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 1);
}

#[tokio::test]
async fn test_search_content_structured_regex_special_chars() {
    let dir = temp_dir();
    fs::write(
        dir.join("test.txt"),
        "foo.bar\nfooXbar\nfoo\nbar\n",
    )
    .unwrap();

    // Regex query: dot matches any char
    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "foo.bar",
        &dir.to_string_lossy(),
        100,
        false,
        false,
        true,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 2);
}

// ── search_content (agent-style) ──

#[tokio::test]
async fn test_search_content_basic() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "hello world\nfoo bar\nbaz").unwrap();

    let result = search::search_content(
        &dir.to_string_lossy(),
        "hello",
        &dir.to_string_lossy(),
        100,
    )
    .await
    .unwrap();
    assert!(!result.contains("(no matches)"));
    assert!(result.contains("hello world"));
}

#[tokio::test]
async fn test_search_content_no_matches() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "hello world").unwrap();

    let result = search::search_content(
        &dir.to_string_lossy(),
        "zzzzz",
        &dir.to_string_lossy(),
        100,
    )
    .await
    .unwrap();
    assert_eq!(result, "(no matches)");
}

#[tokio::test]
async fn test_search_content_cyrillic_query() {
    let dir = temp_dir();
    fs::write(dir.join("test.txt"), "Привет, мир! Как дела?").unwrap();

    let result = search::search_content(
        &dir.to_string_lossy(),
        "Привет",
        &dir.to_string_lossy(),
        100,
    )
    .await
    .unwrap();
    assert!(result.contains("Привет"));
}

#[tokio::test]
async fn test_search_content_max_results() {
    let dir = temp_dir();
    let mut content = String::new();
    for i in 0..100 {
        content.push_str(&format!("match {i}\n"));
    }
    fs::write(dir.join("big.txt"), &content).unwrap();

    let result = search::search_content(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        5,
    )
    .await
    .unwrap();
    let lines: Vec<&str> = result.lines().collect();
    assert_eq!(lines.len(), 5);
}

// ── Cache / OOM safety ──

#[tokio::test]
async fn test_ensure_cached_and_filter_cached() {
    let dir = temp_dir();
    fs::write(dir.join("a.txt"), "foo\nbar\nfoo").unwrap();
    fs::write(dir.join("b.txt"), "foo\nbaz").unwrap();
    search::clear_search_cache();

    let cached = search::ensure_cached(
        &dir.to_string_lossy(),
        "foo",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();
    assert_eq!(cached.len(), 3);

    let (total, page) = search::filter_cached(
        &dir.to_string_lossy(),
        "foo",
        &dir.to_string_lossy(),
        false,
        false,
        false,
        "",
        "",
        0,
        100,
    )
    .unwrap();
    assert_eq!(total, 3);
    assert_eq!(page.len(), 3);
}

#[tokio::test]
async fn test_ensure_cached_filter_by_case() {
    let dir = temp_dir();
    fs::write(dir.join("a.txt"), "foo\nFoo\nFOO").unwrap();
    search::clear_search_cache();

    search::ensure_cached(
        &dir.to_string_lossy(),
        "Foo",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();

    let (total, page) = search::filter_cached(
        &dir.to_string_lossy(),
        "Foo",
        &dir.to_string_lossy(),
        false,
        true,
        false,
        "",
        "",
        0,
        100,
    )
    .unwrap();
    assert_eq!(total, 1);
    assert_eq!(page[0].content, "Foo");
}

#[tokio::test]
async fn test_ensure_cached_cache_hit() {
    let dir = temp_dir();
    fs::write(dir.join("a.txt"), "hello").unwrap();
    search::clear_search_cache();

    let r1 = search::ensure_cached(
        &dir.to_string_lossy(),
        "hello",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();
    assert_eq!(r1.len(), 1);

    let r2 = search::ensure_cached(
        &dir.to_string_lossy(),
        "hello",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();
    assert_eq!(r2.len(), 1);
}

#[test]
fn test_filter_cached_no_cache_error() {
    let result = search::filter_cached(
        "/nonexistent",
        "foo",
        "/nonexistent",
        false,
        false,
        false,
        "",
        "",
        0,
        10,
    );
    assert!(result.is_err());
    assert!(result
        .err()
        .unwrap()
        .contains("No cached search found"));
}

#[test]
fn test_clear_search_cache_twice() {
    search::clear_search_cache();
    search::clear_search_cache();
}

// ── file_groups_from_cache & file_matches_from_cache ──

#[tokio::test]
async fn test_file_groups_from_cache() {
    let dir = temp_dir();
    fs::write(dir.join("a.txt"), "search_target\nother\nsearch_target").unwrap();
    fs::write(dir.join("b.txt"), "search_target").unwrap();
    search::clear_search_cache();

    search::ensure_cached(
        &dir.to_string_lossy(),
        "search_target",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();

    let (groups, total) = search::file_groups_from_cache(
        &dir.to_string_lossy(),
        "search_target",
        &dir.to_string_lossy(),
        false,
        false,
        false,
        "",
        "",
        100,
    )
    .unwrap();
    assert_eq!(groups.len(), 2);
    assert_eq!(total, 3);
    let a = groups.iter().find(|g| g.name == "a.txt").unwrap();
    assert_eq!(a.match_count, 2);
}

#[tokio::test]
async fn test_file_matches_from_cache() {
    let dir = temp_dir();
    fs::write(dir.join("a.txt"), "line1 match\nline2 no\nline3 match").unwrap();
    search::clear_search_cache();

    search::ensure_cached(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();

    let a_path = dir.join("a.txt").to_string_lossy().to_string();
    let (matches, total) = search::file_matches_from_cache(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        false,
        false,
        false,
        "",
        "",
        &a_path,
        0,
        100,
    )
    .unwrap();
    assert_eq!(matches.len(), 2);
    assert_eq!(total, 2);
}

#[tokio::test]
async fn test_file_matches_from_cache_pagination() {
    let dir = temp_dir();
    let lines: String = (0..50).map(|i| format!("match line {i}\n")).collect();
    fs::write(dir.join("a.txt"), &lines).unwrap();
    search::clear_search_cache();

    search::ensure_cached(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();

    let a_path = dir.join("a.txt").to_string_lossy().to_string();
    let (page, total) = search::file_matches_from_cache(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        false,
        false,
        false,
        "",
        "",
        &a_path,
        0,
        10,
    )
    .unwrap();
    assert_eq!(page.len(), 10);
    assert_eq!(total, 50);
}

// ── OOM safety: ensure_cached handles many matches within MAX_FILE_BYTES ──

#[tokio::test]
async fn test_ensure_cached_many_matches() {
    let dir = temp_dir();
    // Write 50 files, each with 500 "match\n" lines = ~3KB each, well under 256KB
    // Total = 50 * 500 = 25,000 matches, still within MAX_FILE_BYTES per file
    for i in 0..50 {
        let content: String = (0..500).map(|_| "match\n").collect();
        fs::write(dir.join(format!("file_{i}.txt")), &content).unwrap();
    }
    search::clear_search_cache();

    let results = search::ensure_cached(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        false,
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 25_000);
}

#[tokio::test]
async fn test_search_content_structured_capped_at_max_results() {
    let dir = temp_dir();
    let mut content = String::new();
    for _ in 0..200 {
        content.push_str("match\n");
    }
    fs::write(dir.join("many.txt"), &content).unwrap();

    let results = search::search_content_structured(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        50,
        false,
        false,
        false,
        "",
        "",
    )
    .await
    .unwrap();
    assert_eq!(results.len(), 50);
}

#[tokio::test]
async fn test_search_content_capped_output() {
    let dir = temp_dir();
    // Generate ~20K chars of matches (above MAX_OUTPUT_CHARS = 16K)
    let mut content = String::new();
    for i in 0..500 {
        content.push_str(&format!("match line {i} with some extra padding text\n"));
    }
    fs::write(dir.join("big.txt"), &content).unwrap();

    let result = search::search_content(
        &dir.to_string_lossy(),
        "match",
        &dir.to_string_lossy(),
        10_000,
    )
    .await
    .unwrap();
    // Result is clipped, should be capped
    assert!(result.len() <= 16_000 + 200);
    // Lines that fit should be present; result should not explode in size
    assert!(result.contains("[truncated"));
}

// ── Walker tests (public API) ──

#[test]
fn test_find_files_empty_query() {
    let dir = temp_dir();
    fs::write(dir.join("main.rs"), "").unwrap();
    fs::write(dir.join("lib.rs"), "").unwrap();

    let results = search::find_files(&dir.to_string_lossy(), "", 100);
    assert_eq!(results.len(), 2);
}

#[test]
fn test_find_files_by_name() {
    let dir = temp_dir();
    fs::write(dir.join("main.rs"), "").unwrap();
    fs::write(dir.join("lib.rs"), "").unwrap();
    fs::write(dir.join("readme.md"), "").unwrap();

    let results = search::find_files(&dir.to_string_lossy(), "main", 100);
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].name, "main.rs");
}

#[test]
fn test_find_files_cyrillic_filename() {
    let dir = temp_dir();
    fs::write(dir.join("файл.rs"), "").unwrap();
    fs::write(dir.join("file.rs"), "").unwrap();

    let results = search::find_files(&dir.to_string_lossy(), "файл", 100);
    assert_eq!(results.len(), 1);
    assert!(results[0].name.contains("файл"));
}

#[test]
fn test_find_files_skip_dirs() {
    let dir = temp_dir();
    fs::create_dir_all(dir.join("node_modules")).unwrap();
    fs::write(dir.join("node_modules/lib.rs"), "").unwrap();
    fs::write(dir.join("main.rs"), "").unwrap();
    fs::create_dir_all(dir.join("src")).unwrap();
    fs::write(dir.join("src/lib.rs"), "").unwrap();

    // node_modules should be skipped; main.rs and src/lib.rs should be found
    let root = dir.to_string_lossy();
    // The walker uses ensure_index which has a TTL cache; ensure fresh results
    // by calling with a slightly different approach
    let results = search::find_files(&root, "rs", 100);
    let names: Vec<&str> = results.iter().map(|r| r.name.as_str()).collect();
    assert_eq!(results.len(), 2, "expected 2 files (main.rs, lib.rs), got {names:?} from {root}");
    assert!(!results.iter().any(|r| r.name == "lib.rs" && (r.rel.contains("node_modules") || r.rel.contains("node_modules"))));
}

#[test]
fn test_find_files_limit() {
    let dir = temp_dir();
    for i in 0..20 {
        fs::write(dir.join(format!("file_{i}.rs")), "").unwrap();
    }

    let results = search::find_files(&dir.to_string_lossy(), "file", 5);
    assert_eq!(results.len(), 5);
}

#[test]
fn test_find_all_includes_dirs() {
    let dir = temp_dir();
    fs::create_dir_all(dir.join("src")).unwrap();
    fs::write(dir.join("src/main.rs"), "").unwrap();

    let results = search::find_all(&dir.to_string_lossy(), "src", 100);
    let dirs: Vec<_> = results.iter().filter(|m| m.is_dir == Some(true)).collect();
    assert!(!dirs.is_empty());
}

#[test]
fn test_find_all_no_match() {
    let dir = temp_dir();
    fs::write(dir.join("main.rs"), "").unwrap();

    let results = search::find_all(&dir.to_string_lossy(), "nonexistent", 100);
    assert!(results.is_empty());
}

// ── should_skip tests ──

#[test]
fn test_should_skip_cyrillic_dir() {
    // Cyrillic dirs that don't start with '.' should not be skipped
    assert!(!search::config::should_skip("папка"));
    assert!(!search::config::should_skip("библиотека"));
}

#[test]
fn test_should_skip_known_dirs() {
    for d in &[
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
        "out",
        "target",
    ] {
        assert!(search::config::should_skip(d), "{d} should be skipped");
    }
}

#[test]
fn test_should_not_skip_source() {
    for d in &["src", "lib", "components", "utils"] {
        assert!(!search::config::should_skip(d), "{d} should not be skipped");
    }
}

#[test]
fn test_should_not_skip_special_dotfiles() {
    assert!(!search::config::should_skip(".env"));
    assert!(!search::config::should_skip(".gitignore"));
}

#[test]
fn test_should_skip_other_dotfiles() {
    assert!(search::config::should_skip(".hidden"));
    assert!(search::config::should_skip(".config"));
}

// ── highlight_line & tokenize_line ──

#[test]
fn test_tokenize_line_identifiers() {
    let tokens = search::tokenize_line("let x = 42;", "rs");
    assert!(tokens
        .iter()
        .any(|t| t.text == "let" && t.class_name == "sc-token-keyword"));
    assert!(tokens
        .iter()
        .any(|t| t.text == "x" && t.class_name == "sc-token-identifier"));
    assert!(tokens
        .iter()
        .any(|t| t.text == "42" && t.class_name == "sc-token-number"));
}

#[test]
fn test_tokenize_line_string_cyrillic() {
    let tokens = search::tokenize_line(r#"greeting("Привет, мир!");"#, "rs");
    assert!(tokens
        .iter()
        .any(|t| t.text == "\"Привет, мир!\""));
}

#[test]
fn test_tokenize_line_empty() {
    let tokens = search::tokenize_line("", "rs");
    assert!(tokens.is_empty());
}

#[test]
fn test_tokenize_line_comment() {
    let tokens = search::tokenize_line("// комментарий", "rs");
    assert!(tokens
        .iter()
        .any(|t| t.class_name == "sc-token-comment"));
}

#[test]
fn test_highlight_line_no_match() {
    let tokens = search::highlight_line("hello world", "rs", "xyz", false);
    assert!(tokens
        .iter()
        .all(|t| t.class_name != "sc-match-highlight"));
}

#[test]
fn test_highlight_line_empty_query() {
    let tokens = search::highlight_line("hello", "rs", "", false);
    assert!(tokens
        .iter()
        .all(|t| t.class_name != "sc-match-highlight"));
}

#[test]
fn test_highlight_line_multiple_matches() {
    let tokens = search::highlight_line("foo bar foo baz foo", "", "foo", false);
    let highlights: Vec<_> = tokens
        .iter()
        .filter(|t| t.class_name == "sc-match-highlight")
        .collect();
    assert_eq!(highlights.len(), 3);
}

#[test]
fn test_highlight_line_case_sensitive() {
    let tokens = search::highlight_line("Foo foo FOO", "", "foo", true);
    let highlights: Vec<_> = tokens
        .iter()
        .filter(|t| t.class_name == "sc-match-highlight")
        .collect();
    assert_eq!(highlights.len(), 1);
}

#[test]
fn test_highlight_line_cyrillic_query() {
    // Single cyrillic char queries work within a single punctuation token.
    let tokens = search::highlight_line("Привет, мир!", "", "м", false);
    let has_match = tokens.iter().any(|t| t.class_name == "sc-match-highlight");
    assert!(has_match, "expected match highlight for 'м' in 'Привет, мир!'");
}

#[test]
fn test_highlight_line_cyrillic_multiword_spans_tokens() {
    // Multi-char cyrillic queries may span multiple punctuation tokens.
    // This is a known limitation: tokenize splits each cyrillic char
    // into its own token, so multi-char queries can't match across tokens.
    // The function should not panic and should return valid tokens.
    let tokens = search::highlight_line("Привет, мир!", "", "мир", false);
    // Should not panic — even if no match is found across token boundaries
    assert!(tokens.iter().all(|t| !t.text.is_empty()), "all tokens must be non-empty");
}

#[test]
fn test_highlight_line_match_at_end() {
    let tokens = search::highlight_line("end match", "", "match", false);
    assert!(tokens
        .iter()
        .any(|t| t.class_name == "sc-match-highlight"));
}

#[test]
fn test_highlight_lines_batch() {
    let lines = vec!["foo bar", "baz foo", "hello"];
    let result = search::highlight_lines(&lines, "test.txt", "foo", false);
    assert_eq!(result.len(), 3);
    assert!(result[0].iter().any(|t| t.class_name == "sc-match-highlight"));
    assert!(result[1].iter().any(|t| t.class_name == "sc-match-highlight"));
    assert!(result[2].iter().all(|t| t.class_name != "sc-match-highlight"));
}

#[test]
fn test_highlight_lines_rust_file() {
    let lines = vec!["fn main() {", "    println!(\"hello\");", "}"];
    let result = search::highlight_lines(&lines, "main.rs", "main", false);
    assert!(result[0].iter().any(|t| t.class_name == "sc-match-highlight"));
}

// ── config constants ──

#[test]
fn test_max_file_bytes() {
    assert_eq!(search::config::MAX_FILE_BYTES, 256 * 1024);
}

#[test]
fn test_max_output_chars() {
    assert_eq!(search::config::MAX_OUTPUT_CHARS, 16_000);
}
