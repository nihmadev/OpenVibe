use crate::types::{ContextSnippet, LineRange};
use std::path::{Path, PathBuf};

pub struct GitDeltaProvider;

impl GitDeltaProvider {
    pub fn get_uncommitted_snippets(cwd: &Path, max_files: usize) -> Vec<ContextSnippet> {
        let cwd_str = match cwd.to_str() {
            Some(s) => s,
            None => return Vec::new(),
        };

        let diff_files = match git::get_working_tree_diff(cwd_str) {
            Ok(files) => files,
            Err(_) => return Vec::new(),
        };

        let mut snippets = Vec::new();

        for file in diff_files.into_iter().take(max_files) {
            let rel_path = PathBuf::from(&file.path);
            let mut diff_text = String::new();
            let mut first_start = 1u32;
            let mut last_end = 1u32;

            for hunk in file.hunks {
                if first_start == 1 && hunk.new_start > 0 {
                    first_start = hunk.new_start as u32;
                }
                last_end = (hunk.new_start + hunk.new_lines) as u32;

                diff_text.push_str(&format!("@@ {}\n", hunk.header));
                for line in hunk.lines.iter().take(30) {
                    diff_text.push_str(&format!("{}{}", line.origin, line.content));
                }
            }

            if !diff_text.is_empty() {
                snippets.push(ContextSnippet {
                    path: rel_path,
                    range: LineRange {
                        start_line: first_start,
                        end_line: last_end.max(first_start),
                    },
                    content: diff_text,
                    score: 0.85,
                    reason: format!("Uncommitted Git Changes (Status: {})", file.status),
                });
            }
        }

        snippets
    }

    pub fn get_temporally_coupled_snippets(
        cwd: &Path,
        active_file: &Path,
        max_files: usize,
    ) -> Vec<ContextSnippet> {
        let cwd_str = match cwd.to_str() {
            Some(s) => s,
            None => return Vec::new(),
        };

        let active_str = match active_file.to_str() {
            Some(s) => s,
            None => return Vec::new(),
        };

        // Call the new history API
        let coupled = git::get_co_committed_files(cwd_str, active_str, max_files);

        let mut snippets = Vec::new();
        for file in coupled {
            let path = PathBuf::from(&file);
            let abs_path = cwd.join(&path);

            if let Ok(content) = std::fs::read_to_string(&abs_path) {
                // In a real implementation we might pass ast_service to skeletonize here,
                // but since git_delta is a generic provider, we can just return the first few lines
                // or rely on assembler to skeletonize it later. For now, we return it.
                // However, to keep it simple and localized, let's extract up to 50 lines.
                let lines: Vec<&str> = content.lines().collect();
                let end = 50.min(lines.len());
                let snippet_text = lines[0..end].join("\n");

                snippets.push(ContextSnippet {
                    path,
                    range: LineRange {
                        start_line: 1,
                        end_line: end as u32,
                    },
                    content: snippet_text,
                    score: 0.75, // Good score for temporal coupling
                    reason: "Temporal Git Coupling (Co-committed)".to_string(),
                });
            }
        }

        snippets
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_git_delta_empty_non_repo() {
        let dir = tempdir().unwrap();
        let snippets = GitDeltaProvider::get_uncommitted_snippets(dir.path(), 5);
        assert!(snippets.is_empty());
    }
}
