use std::path::{Path, PathBuf};

use crate::{is_ignored, load_gitignore, should_skip};

#[derive(Debug, Clone)]
pub struct TextMatch {
    pub path: PathBuf,
    pub line: usize,
    pub content: String,
}

#[derive(Debug, Clone, Default)]
pub struct TextScan {
    pub matches: Vec<TextMatch>,
    pub skipped_large_files: usize,
    pub hit_result_cap: bool,
}

pub fn walk_files(root: &Path, max_files: usize) -> Vec<PathBuf> {
    if root.is_file() {
        return vec![root.to_path_buf()];
    }

    let gitignore = load_gitignore(root);
    let mut files = Vec::new();
    let mut directories = vec![root.to_path_buf()];
    while let Some(directory) = directories.pop() {
        let Ok(entries) = std::fs::read_dir(directory) else {
            continue;
        };
        for entry in entries.flatten() {
            if files.len() >= max_files {
                return files;
            }
            let name = entry.file_name();
            if should_skip(&name.to_string_lossy()) {
                continue;
            }
            let path = entry.path();
            let Ok(file_type) = entry.file_type() else {
                continue;
            };
            if let Some(gitignore) = &gitignore {
                if let Ok(relative) = path.strip_prefix(root) {
                    if is_ignored(gitignore, relative, file_type.is_dir()) {
                        continue;
                    }
                }
            }
            if file_type.is_dir() {
                directories.push(path);
            } else if file_type.is_file() {
                files.push(path);
            }
        }
    }
    files
}

pub fn scan_text(
    root: &Path,
    max_results: usize,
    max_file_bytes: u64,
    mut line_matches: impl FnMut(&str) -> bool,
) -> TextScan {
    let mut scan = TextScan::default();
    for path in walk_files(root, usize::MAX) {
        if scan.matches.len() >= max_results {
            scan.hit_result_cap = true;
            break;
        }
        if path
            .metadata()
            .is_ok_and(|meta| meta.len() > max_file_bytes)
        {
            scan.skipped_large_files += 1;
            continue;
        }
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        for (line_index, line) in text.lines().enumerate() {
            if scan.matches.len() >= max_results {
                scan.hit_result_cap = true;
                break;
            }
            if line_matches(line) {
                scan.matches.push(TextMatch {
                    path: path.clone(),
                    line: line_index + 1,
                    content: line.to_string(),
                });
            }
        }
    }
    scan
}
