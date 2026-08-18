use jwalk::WalkDir;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

use crate::{is_ignored, load_gitignore, relative_path, should_skip};
use serde::Serialize;

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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMatch {
    pub path: String,
    pub rel: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_dir: Option<bool>,
}

fn walk(root: &Path) -> Vec<WalkEntry> {
    let mut out = Vec::new();
    let gitignore = load_gitignore(root);
    let root_owned = root.to_path_buf();

    let walk = WalkDir::new(root).process_read_dir(move |_depth, _path, _state, children| {
        children.retain(|entry_result| {
            let entry = match entry_result {
                Ok(e) => e,
                Err(_) => return false,
            };
            let name = entry.file_name.to_string_lossy().to_string();
            if should_skip(&name) {
                return false;
            }
            if let Some(ref gi) = gitignore {
                if let Ok(rel) = entry.path().strip_prefix(&root_owned) {
                    if is_ignored(gi, rel, entry.file_type().is_dir()) {
                        return false;
                    }
                }
            }
            true
        });
    });

    for entry in walk.into_iter() {
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
    let h = haystack.to_lowercase().replace('\\', "/");
    let n = needle.to_lowercase().replace('\\', "/");

    if n.is_empty() {
        let base = h.split('/').next_back().unwrap_or(&h);
        let depth = h.match_indices('/').count() as f64;
        let mut penalty = 0.0;
        if base.ends_with(".mod")
            || base.ends_with(".sum")
            || base.ends_with(".lock")
            || base.starts_with('.')
        {
            penalty -= 20.0;
        }
        return 1.0 + depth * 3.0 + penalty;
    }

    let base = h.split('/').next_back().unwrap_or(&h).to_string();
    if base == n {
        return 200.0 - h.len() as f64 / 1000.0;
    }
    if base.starts_with(&n) {
        return 150.0 - h.len() as f64 / 1000.0;
    }
    if base.contains(&n) {
        return 100.0 - h.len() as f64 / 1000.0;
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
            let r = relative_path(Path::new(&e.path), Path::new(root));
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
            let r = relative_path(Path::new(&e.path), Path::new(root));
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
            let r = relative_path(Path::new(&e.path), Path::new(root));
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
            let r = relative_path(Path::new(&e.path), Path::new(root));
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
