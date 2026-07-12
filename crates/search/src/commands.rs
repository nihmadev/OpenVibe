use serde_json;
use std::fs;
use std::path::Path;

use crate::config::should_skip;
use crate::types::{FileMatch, FsEntry};
use crate::walker;

const TEXT_FILE_LIMIT: u64 = 2 * 1024 * 1024;

pub fn fs_list(dir: String) -> Result<Vec<FsEntry>, String> {
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    let mut result: Vec<FsEntry> = entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            !should_skip(&name)
        })
        .map(|e| {
            let path = e.path();
            let name = e.file_name().to_string_lossy().to_string();
            let full = path.to_string_lossy().to_string();
            let is_dir = path.is_dir();
            let size = if path.is_file() {
                path.metadata().ok().map(|m| m.len())
            } else {
                None
            };
            FsEntry {
                name,
                path: full,
                is_dir,
                size,
            }
        })
        .collect();
    result.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return if a.is_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    Ok(result)
}

pub fn fs_read(path: String) -> Result<String, String> {
    let p = Path::new(&path);
    let meta = p.metadata().map_err(|e| e.to_string())?;
    if meta.len() > TEXT_FILE_LIMIT {
        return Err(format!("File too large ({} bytes)", meta.len()));
    }
    fs::read_to_string(p).map_err(|e| e.to_string())
}

pub fn fs_read_binary(path: String) -> Result<serde_json::Value, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    let size = data.len();
    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
    Ok(serde_json::json!({ "data": b64, "size": size }))
}

pub fn fs_write(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, &content).map_err(|e| e.to_string())
}

pub fn fs_find(root: String, query: String, limit: Option<usize>) -> Vec<FileMatch> {
    walker::find_files(&root, &query, limit.unwrap_or(30))
}

pub fn fs_find_all(root: String, query: String, limit: Option<usize>) -> Vec<FileMatch> {
    walker::find_all(&root, &query, limit.unwrap_or(50))
}
