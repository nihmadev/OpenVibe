use jwalk::WalkDir;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::config::should_skip;
use crate::types::FileMatch;

const MAX_FILES: usize = 8000;
const CACHE_TTL: Duration = Duration::from_secs(10);

#[derive(Debug, Clone)]
struct WalkEntry {
    path: String,
    is_dir: bool,
}

struct CacheEntry {
    files: Vec<WalkEntry>,
    at: Instant,
}

static CACHE: Lazy<Mutex<HashMap<String, CacheEntry>>> = Lazy::new(|| Mutex::new(HashMap::new()));

fn relpath(path: &str, base: &str) -> String {
    let p = Path::new(path);
    let b = Path::new(base);
    if let Ok(rel) = p.strip_prefix(b) {
        rel.to_string_lossy().to_string()
    } else {
        path.to_string()
    }
}

fn walk(root: &Path) -> Vec<WalkEntry> {
    let mut out = Vec::new();
    for entry in WalkDir::new(root)
        .into_iter()
        .filter(|e| match e {
            Ok(e) => !should_skip(&e.file_name().to_string_lossy().to_string()),
            Err(_) => false,
        })
    {
        if out.len() >= MAX_FILES {
            break;
        }
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let full = entry.path().to_string_lossy().to_string();
        if entry.file_type().is_dir() {
            out.push(WalkEntry {
                path: full,
                is_dir: true,
            });
        } else if entry.file_type().is_file() {
            out.push(WalkEntry {
                path: full,
                is_dir: false,
            });
        }
    }
    out
}

fn ensure_index(root: &str) -> Vec<WalkEntry> {
    let mut cache = CACHE.lock().unwrap();
    if let Some(entry) = cache.get(root) {
        if entry.at.elapsed() < CACHE_TTL {
            return entry.files.clone();
        }
    }
    let files = walk(Path::new(root));
    cache.insert(
        root.to_string(),
        CacheEntry {
            files: files.clone(),
            at: Instant::now(),
        },
    );
    files
}

fn score(haystack: &str, needle: &str) -> f64 {
    if needle.is_empty() {
        return 1.0;
    }
    let h = haystack.to_lowercase();
    let n = needle.to_lowercase();
    let base = h
        .split(|c: char| c == '/' || c == '\\')
        .last()
        .unwrap_or(&h)
        .to_string();
    if base.contains(&n) {
        let bonus = if base.starts_with(&n) { 50.0 } else { 0.0 };
        return 100.0 + bonus - h.len() as f64 / 1000.0;
    }
    if h.contains(&n) {
        return 50.0 - h.len() as f64 / 1000.0;
    }
    let mut i = 0;
    let hb = h.as_bytes();
    let nb = n.as_bytes();
    for &c in hb {
        if i < nb.len() && c == nb[i] {
            i += 1;
        }
    }
    if i == nb.len() {
        return 10.0 - (h.len() - n.len()) as f64 / 1000.0;
    }
    -1.0
}

pub fn find_files(root: &str, query: &str, limit: usize) -> Vec<FileMatch> {
    let entries = ensure_index(root);
    let mut ranked: Vec<(f64, WalkEntry)> = entries
        .into_iter()
        .filter(|e| !e.is_dir)
        .filter_map(|e| {
            let r = relpath(&e.path, root);
            let s = score(&r, query);
            if s > 0.0 {
                Some((s, e))
            } else {
                None
            }
        })
        .collect();
    ranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    ranked
        .into_iter()
        .take(limit)
        .map(|(_, e)| {
            let r = relpath(&e.path, root);
            let name = Path::new(&e.path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| e.path.clone());
            FileMatch {
                path: e.path,
                rel: r,
                name,
                is_dir: Some(false),
            }
        })
        .collect()
}

pub fn find_all(root: &str, query: &str, limit: usize) -> Vec<FileMatch> {
    let entries = ensure_index(root);
    let mut ranked: Vec<(f64, WalkEntry)> = entries
        .into_iter()
        .filter_map(|e| {
            let r = relpath(&e.path, root);
            let s = score(&r, query);
            if s > 0.0 {
                Some((s, e))
            } else {
                None
            }
        })
        .collect();
    ranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    ranked
        .into_iter()
        .take(limit)
        .map(|(_, e)| {
            let r = relpath(&e.path, root);
            let name = Path::new(&e.path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| e.path.clone());
            FileMatch {
                path: e.path,
                rel: r,
                name,
                is_dir: Some(e.is_dir),
            }
        })
        .collect()
}
