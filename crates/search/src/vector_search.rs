use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::Mutex;

use crate::config::{should_skip, MAX_FILE_BYTES};
use crate::types::SearchResult;

const CHUNK_LINES: usize = 85;
const SIMILARITY_THRESHOLD: f64 = 0.2;

struct IndexEntry {
    path: String,
    line: usize,
    content: String,
    embedding: Vec<f32>,
}

static MODEL: Lazy<Mutex<Option<TextEmbedding>>> = Lazy::new(|| Mutex::new(None));

static INDEX_CACHE: Lazy<Mutex<HashMap<String, Vec<IndexEntry>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub fn ensure_model() -> Result<(), String> {
    let mut guard = MODEL.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Ok(());
    }
    *guard = Some(
        TextEmbedding::try_new(
            InitOptions::new(EmbeddingModel::BGESmallENV15).with_show_download_progress(true),
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

    for entry in jwalk::WalkDir::new(root).into_iter().filter(|e| match e {
        Ok(e) => !should_skip(e.file_name().to_string_lossy().as_ref()),
        Err(_) => false,
    }) {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        if !entry.file_type().is_file() {
            continue;
        }
        if let Ok(meta) = entry.metadata() {
            if meta.len() > MAX_FILE_BYTES || meta.len() == 0 {
                continue;
            }
        }
        let path = entry.path();
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

    if file_texts.is_empty() {
        let mut cache = INDEX_CACHE.lock().map_err(|e| e.to_string())?;
        cache.insert(root.to_string(), Vec::new());
        return Ok(());
    }

    let prefixed: Vec<String> = file_texts.iter().map(|s| format!("passage: {s}")).collect();
    let refs: Vec<&str> = prefixed.iter().map(|s| s.as_str()).collect();
    let embeddings = m
        .embed(refs, Some(256))
        .map_err(|e| format!("Embedding failed: {e}"))?;

    let entries: Vec<IndexEntry> = file_meta
        .into_iter()
        .zip(file_texts.into_iter().zip(embeddings))
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
    m.embed(texts, None)
        .map_err(|e| format!("embed_texts failed: {e}"))
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
        assert!((sim - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = vec![1.0, 0.0, 0.0];
        let b = vec![0.0, 1.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_scaled() {
        let a = vec![1.0, 2.0, 3.0];
        let b = vec![2.0, 4.0, 6.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_zero_vec() {
        let a = vec![0.0, 0.0, 0.0];
        let b = vec![1.0, 0.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 0.0).abs() < 1e-6);
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
        assert!(
            !should_skip(".gitignore"),
            ".gitignore should not be skipped"
        );
    }

    #[test]
    fn test_ensure_model() -> Result<(), String> {
        ensure_model()?;
        let guard = MODEL.lock().map_err(|e| e.to_string())?;
        assert!(
            guard.is_some(),
            "model should be loaded after ensure_model()"
        );
        Ok(())
    }
}
