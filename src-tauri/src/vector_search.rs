use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use once_cell::sync::Lazy;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;

const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "out",
    ".cache",
    ".turbo",
    "coverage",
    ".vite",
    "target",
    ".vscode",
];
const MAX_FILE_BYTES: u64 = 256 * 1024;
const CHUNK_LINES: usize = 85;
const SIMILARITY_THRESHOLD: f64 = 0.2;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub path: String,
    pub line: usize,
    pub content: String,
    pub score: f64,
}

struct IndexEntry {
    path: String,
    line: usize,
    content: String,
    embedding: Vec<f32>,
}

static MODEL: Lazy<Mutex<Option<TextEmbedding>>> = Lazy::new(|| Mutex::new(None));

static INDEX_CACHE: Lazy<Mutex<HashMap<String, Vec<IndexEntry>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

fn should_skip(name: &str) -> bool {
    SKIP_DIRS.contains(&name) || (name.starts_with('.') && name != ".env" && name != ".gitignore")
}

pub fn ensure_model() -> Result<(), String> {
    let mut guard = MODEL.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    *guard = Some(
        TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::BGESmallENV15)
                .with_show_download_progress(true),
        )
        .map_err(|e| format!("Failed to load embedding model: {e}"))?,
    );
    Ok(())
}

pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f64 {
    let dot: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
    let norm_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
    let norm_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    (dot / (norm_a * norm_b)) as f64
}

pub fn build_index(root: &str) -> Result<(), String> {
    ensure_model()?;
    let mut guard = MODEL.lock().map_err(|e| e.to_string())?;
    let m = guard.as_mut().ok_or("Model not loaded")?;

    let mut file_texts: Vec<String> = Vec::new();
    let mut file_meta: Vec<(String, usize)> = Vec::new();
    let mut dirs: Vec<String> = vec![root.to_string()];

    while let Some(dir) = dirs.pop() {
        let read_dir = match std::fs::read_dir(&dir) {
            Ok(d) => d,
            Err(_) => continue,
        };
        for entry in read_dir.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if should_skip(&name) {
                continue;
            }
            let path = entry.path();
            if path.is_dir() {
                dirs.push(path.to_string_lossy().to_string());
            } else if path.is_file() {
                if let Ok(meta) = entry.metadata() {
                    if meta.len() > MAX_FILE_BYTES || meta.len() == 0 {
                        continue;
                    }
                }
                let text = match std::fs::read_to_string(&path) {
                    Ok(t) => t,
                    Err(_) => continue,
                };
                let path_str = path.to_string_lossy().to_string();
                let lines: Vec<&str> = text.lines().collect();

                if lines.len() <= CHUNK_LINES {
                    file_texts.push(text);
                    file_meta.push((path_str, 1));
                } else {
                    for chunk_start in (0..lines.len()).step_by(CHUNK_LINES) {
                        let chunk_end = (chunk_start + CHUNK_LINES).min(lines.len());
                        let chunk = lines[chunk_start..chunk_end].join("\n");
                        file_texts.push(chunk);
                        file_meta.push((path_str.clone(), chunk_start + 1));
                    }
                }
            }
        }
    }

    if file_texts.is_empty() {
        let mut cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
        cache.insert(root.to_string(), Vec::new());
        return Ok(());
    }

    let prefixed: Vec<String> = file_texts
        .iter()
        .map(|s| format!("passage: {s}"))
        .collect();
    let refs: Vec<&str> = prefixed.iter().map(|s| s.as_str()).collect();
    let embeddings = m
        .embed(refs, Some(256))
        .map_err(|e| format!("Embedding failed: {e}"))?;

    let entries: Vec<IndexEntry> = file_meta
        .into_iter()
        .zip(file_texts.into_iter().zip(embeddings.into_iter()))
        .map(|((path, line), (content, embedding))| IndexEntry {
            path,
            line,
            content,
            embedding,
        })
        .collect();

    let mut cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
    cache.insert(root.to_string(), entries);
    Ok(())
}

pub fn search_codebase_vector(
    query: &str,
    root: &str,
    max_results: usize,
) -> Result<Vec<SearchResult>, String> {
    ensure_model()?;

    {
        let cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
        if !cache.contains_key(root) {
            drop(cache);
            build_index(root)?;
        }
    }

    let mut guard = MODEL.lock().map_err(|e| e.to_string())?;
    let m = guard.as_mut().ok_or("Model not loaded")?;

    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let query_text = format!("query: {trimmed}");
    let query_emb = m
        .embed([query_text.as_str()], None)
        .map_err(|e| format!("Query embedding failed: {e}"))?
        .into_iter()
        .next()
        .ok_or("No embedding for query")?;

    let query_lower = trimmed.to_lowercase();

    let cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
    let entries = match cache.get(root) {
        Some(e) => e,
        None => return Ok(Vec::new()),
    };

    let mut results: Vec<(f64, &IndexEntry)> = entries
        .iter()
        .map(|entry| {
            let vector_score = cosine_similarity(&query_emb, &entry.embedding);
            let keyword_boost = if entry.content.to_lowercase().contains(&query_lower) {
                0.3
            } else {
                0.0
            };
            let final_score = vector_score * 0.7 + keyword_boost;
            (final_score, entry)
        })
        .filter(|(score, _)| *score > SIMILARITY_THRESHOLD)
        .collect();

    results.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    results.truncate(max_results);

    Ok(results
        .into_iter()
        .map(|(score, entry)| SearchResult {
            path: entry.path.clone(),
            line: entry.line,
            content: entry.content.clone(),
            score,
        })
        .collect())
}

pub fn embed_texts(texts: Vec<&str>) -> Result<Vec<Vec<f32>>, String> {
    ensure_model()?;
    let mut guard = MODEL.lock().map_err(|e| e.to_string())?;
    let m = guard.as_mut().ok_or("Model not loaded")?;
    m.embed(texts, None).map_err(|e| format!("embed_texts failed: {e}"))
}

pub fn clear_cache(root: &str) -> Result<(), String> {
    let mut cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
    cache.remove(root);
    Ok(())
}

pub fn clear_all_caches() -> Result<(), String> {
    let mut cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
    cache.clear();
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir() -> String {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir()
            .join("openvibe_vec_test")
            .join(format!("test_{ts}"));
        fs::create_dir_all(&dir).unwrap();
        dir.to_string_lossy().to_string()
    }

    #[test]
    fn test_cosine_similarity_identical() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 1e-6, "identical vectors should have similarity 1.0, got {sim}");
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 1e-6, "orthogonal vectors should have similarity 0.0, got {sim}");
    }

    #[test]
    fn test_cosine_similarity_scaled() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![2.0, 4.0, 6.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 1e-6, "scaled vectors should have similarity 1.0, got {sim}");
    }

    #[test]
    fn test_cosine_similarity_zero_vec() {
        let a = vec![0.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 1e-6, "zero vector should give similarity 0.0, got {sim}");
    }

    #[test]
    fn test_should_skip_known_dirs() {
        for d in &["node_modules", ".git", "dist", "build", ".next", "out", "target"] {
            assert!(should_skip(d), "{d} should be skipped");
        }
    }

    #[test]
    fn test_should_not_skip_source() {
        for d in &["src", "lib", "components", "utils"] {
            assert!(!should_skip(d), "{d} should not be skipped");
        }
    }

    #[test]
    fn test_should_not_skip_special_dotfiles() {
        assert!(!should_skip(".env"), ".env should not be skipped");
        assert!(!should_skip(".gitignore"), ".gitignore should not be skipped");
    }

    #[test]
    fn test_model_is_alive_and_embeds() -> Result<(), String> {
        ensure_model()?;
        let mut guard = MODEL.lock().map_err(|e| e.to_string())?;
        let m = guard.as_mut().ok_or("Model not loaded")?;

        let docs = vec!["passage: fn add(a: i32, b: i32) -> i32 { a + b }",
                        "passage: fn greet(name: &str) -> String { format!(\"Hello {name}\") }"];
        let embs = m.embed(docs, None).map_err(|e| format!("embed failed: {e}"))?;
        assert_eq!(embs.len(), 2, "should have 2 embeddings");

        let sim = cosine_similarity(&embs[0], &embs[1]);
        println!("  embedding dim: {}", embs[0].len());
        println!("  embedding[0][..4]: {:?}", &embs[0][..4]);
        println!("  similarity between add/greet: {:.4}", sim);

        assert!(embs[0].len() == 384, "bge-small-en-v1.5 should output 384-dim vectors");
        assert!(sim > 0.0 && sim < 1.0, "similarity should be between 0 and 1, got {sim}");

        // Now embed a "query:" and check higher similarity to the right doc
        let q = m.embed(vec!["query: calculate sum of two integers"], None)
            .map_err(|e| format!("query embed failed: {e}"))?;
        let sim_add = cosine_similarity(&q[0], &embs[0]);
        let sim_greet = cosine_similarity(&q[0], &embs[1]);
        println!("  query→add:    {:.4}", sim_add);
        println!("  query→greet:  {:.4}", sim_greet);
        assert!(sim_add > sim_greet,
            "query about adding should be closer to add() than to greet(), got add={sim_add:.4} greet={sim_greet:.4}");

        Ok(())
    }

    #[test]
    fn test_build_index_and_vector_search() -> Result<(), String> {
        let root = test_dir();

        fs::write(
            std::path::Path::new(&root).join("math_utils.rs"),
            "pub fn calculate_sum(a: i32, b: i32) -> i32 { a + b }",
        )
        .unwrap();
        fs::write(
            std::path::Path::new(&root).join("string_utils.rs"),
            "pub fn greet(name: &str) -> String { format!(\"Hello, {name}!\") }",
        )
        .unwrap();
        fs::write(
            std::path::Path::new(&root).join("main.rs"),
            "fn main() { println!(\"Hello world\"); }",
        )
        .unwrap();

        build_index(&root)?;

        let results = search_codebase_vector("adding numbers", &root, 10)?;
        assert!(!results.is_empty(), "should find results for 'adding numbers'");
        let found_math = results.iter().any(|r| r.path.contains("math_utils"));
        assert!(found_math, "should find math_utils.rs for 'adding numbers' query");

        let results = search_codebase_vector("hello greeting", &root, 10)?;
        assert!(!results.is_empty(), "should find results for 'hello greeting'");
        println!("  greeting results:");
        for r in &results {
            println!("    {:.3}  {}:{}", r.score, r.path, r.line);
        }
        let found_greet = results.iter().any(|r| r.path.contains("string_utils"))
            || results.iter().any(|r| r.path.contains("main"));
        assert!(found_greet, "should find greeting-related files");

        let _ = fs::remove_dir_all(&root);
        Ok(())
    }

    #[test]
    fn test_combined_ranking_boosts_exact_match() -> Result<(), String> {
        let root = test_dir();

        fs::write(
            std::path::Path::new(&root).join("auth.rs"),
            "pub fn login(username: &str, password: &str) -> bool { true }",
        )
        .unwrap();
        fs::write(
            std::path::Path::new(&root).join("db.rs"),
            "pub fn query(sql: &str) -> Vec<Row> { vec![] }",
        )
        .unwrap();

        build_index(&root)?;

        // Query with a word that exists literally in auth.rs
        let results = search_codebase_vector("login function", &root, 10)?;
        let top = results.first().expect("should have at least one result");
        assert!(top.path.contains("auth.rs"),
            "top result for 'login function' should be auth.rs, got {} (score={:.3})", top.path, top.score);
        // The keyword boost should push auth.rs above db.rs
        let db_result = results.iter().find(|r| r.path.contains("db.rs"));
        if let Some(db) = db_result {
            assert!(top.score >= db.score,
                "auth.rs ({:.3}) should rank >= db.rs ({:.3}) for 'login function'", top.score, db.score);
        }

        println!("  ranking test:");
        for r in &results {
            println!("    {:.3}  {}", r.score, r.path);
        }

        let _ = fs::remove_dir_all(&root);
        Ok(())
    }

    #[test]
    fn test_build_index_empty_dir() -> Result<(), String> {
        let root = test_dir();
        build_index(&root)?;
        let results = search_codebase_vector("anything", &root, 10)?;
        assert!(results.is_empty());
        let _ = fs::remove_dir_all(&root);
        Ok(())
    }

    #[test]
    fn test_clear_cache() {
        let root = test_dir();
        fs::write(std::path::Path::new(&root).join("a.rs"), "fn a() {}").unwrap();
        assert!(clear_cache(&root).is_ok());
        assert!(clear_all_caches().is_ok());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn test_ensure_model() -> Result<(), String> {
        ensure_model()?;
        let guard = MODEL.lock().map_err(|e| e.to_string())?;
        assert!(guard.is_some(), "model should be loaded after ensure_model()");
        Ok(())
    }
}
