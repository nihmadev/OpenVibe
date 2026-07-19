use crate::diagnostics::DiagnosticsStore;
use crate::git_delta::GitDeltaProvider;
use crate::graph::ContextGraph;
use crate::recency::RecencyStore;
use crate::types::{ContextSnippet, LineRange, Scg2Config};
use std::fs;
use std::path::Path;
use std::time::Instant;

fn query_tokens(query: &str) -> Vec<String> {
    query
        .to_lowercase()
        .split(|ch: char| !ch.is_alphanumeric() && ch != '_' && ch != '-')
        .filter(|token| !token.is_empty())
        .map(str::to_string)
        .collect()
}

fn detect_explicit_crate_scopes(cwd: &Path, query: &str) -> Vec<std::path::PathBuf> {
    let crates_dir = cwd.join("crates");
    let Ok(entries) = fs::read_dir(&crates_dir) else {
        return Vec::new();
    };

    let query_lower = query.to_lowercase().replace('\\', "/");
    let tokens = query_tokens(query);
    let crate_markers: Vec<usize> = tokens
        .iter()
        .enumerate()
        .filter_map(|(index, token)| {
            (token.starts_with("crate") || token.starts_with("крейт")).then_some(index)
        })
        .collect();

    let mut scopes = Vec::new();
    for entry in entries.flatten() {
        if !entry.file_type().is_ok_and(|kind| kind.is_dir()) {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_lowercase();
        let explicit_path = query_lower.contains(&format!("crates/{name}"));
        let named_near_marker = tokens.iter().enumerate().any(|(index, token)| {
            token == &name
                && crate_markers
                    .iter()
                    .any(|marker| index.abs_diff(*marker) <= 2)
        });

        if explicit_path || named_near_marker {
            scopes.push(std::path::PathBuf::from("crates").join(name));
        }
    }
    scopes.sort();
    scopes.dedup();
    scopes
}

fn path_is_in_scopes(path: &Path, cwd: &Path, scopes: &[std::path::PathBuf]) -> bool {
    let relative = path.strip_prefix(cwd).unwrap_or(path);
    scopes.iter().any(|scope| relative.starts_with(scope))
}

/// Evaluates candidate code snippets across workspace heuristics and constructs token-bounded LLM prompt blocks.
pub struct ContextAssembler {
    config: Scg2Config,
}

impl ContextAssembler {
    /// Creates a new `ContextAssembler` instance with specified configuration limits.
    pub fn new(config: Scg2Config) -> Self {
        Self { config }
    }

    /// Evaluates recency decay, AST symbol dependency links, workspace diagnostics, and project rules to rank snippets.
    pub fn assemble_context(
        &self,
        recency: &RecencyStore,
        graph: &ContextGraph,
        diagnostics: &DiagnosticsStore,
        cwd: &Path,
        user_query: Option<&str>,
    ) -> Vec<ContextSnippet> {
        let now = Instant::now();
        let mut candidates: Vec<ContextSnippet> = Vec::new();
        let mut ast_service = crate::ast::AstService::new();
        let explicit_scopes = user_query
            .map(|query| detect_explicit_crate_scopes(cwd, query))
            .unwrap_or_default();

        // 1. Explicit User Selection Snippet (Highest Priority - Score 1.0)
        if let Some(active_file) = recency.active_file() {
            if let Some(entry) = recency.get_entry(active_file) {
                if let Some(ref sel) = entry.active_selection {
                    if !sel.selected_text.trim().is_empty() {
                        let rel_path = active_file.strip_prefix(cwd).unwrap_or(active_file);
                        candidates.push(ContextSnippet {
                            path: rel_path.to_path_buf(),
                            range: LineRange {
                                start_line: sel.start_line,
                                end_line: sel.end_line,
                            },
                            content: sel.selected_text.clone(),
                            score: 1.0,
                            reason: "Explicit Code Selection in Editor".to_string(),
                        });
                    }
                }
            }
        }

        // 2. Active Compiler/Linter Diagnostic Errors (Score 0.95)
        candidates.extend(diagnostics.get_diagnostic_snippets(cwd));

        // 3. Uncommitted Git Changes (Score 0.85)
        candidates.extend(GitDeltaProvider::get_uncommitted_snippets(cwd, 3));

        // 3.5 Temporal Git Coupling (Score 0.75)
        if let Some(active_file) = recency.active_file() {
            candidates.extend(GitDeltaProvider::get_temporally_coupled_snippets(
                cwd,
                active_file,
                2,
            ));
        }

        // 4. Primary Focus Snippet (Active file & visible line range - Score 0.9)
        if let Some(active_file) = recency.active_file() {
            if let Some(entry) = recency.get_entry(active_file) {
                if let Ok(content) = fs::read_to_string(active_file) {
                    let lines: Vec<&str> = content.lines().collect();
                    let total_lines = lines.len() as u32;

                    let (start, end) = if let Some(ref cursor) = entry.active_cursor {
                        let s = cursor.line.saturating_sub(35).max(1);
                        let e = (cursor.line + 35).min(total_lines);
                        (s, e)
                    } else if let Some(range) = entry.visible_ranges.first() {
                        (range.start_line, range.end_line)
                    } else {
                        (1, 80.min(total_lines))
                    };

                    let snippet_text = self.extract_lines(&lines, start, end);
                    let rel_path = active_file.strip_prefix(cwd).unwrap_or(active_file);

                    candidates.push(ContextSnippet {
                        path: rel_path.to_path_buf(),
                        range: LineRange {
                            start_line: start,
                            end_line: end,
                        },
                        content: snippet_text,
                        score: 0.9,
                        reason: "Active Editor Focus & Cursor Neighborhood".to_string(),
                    });
                }
            }
        }

        // 5. Connected AST Dependency Files (1-hop graph neighbors)
        if let Some(active_file) = recency.active_file() {
            let connected = graph.get_connected_files(active_file, 1);
            for conn_path in connected {
                let rec_score = recency.calculate_score(&conn_path, now);
                let score = 0.6 + 0.3 * rec_score;

                if let Ok(content) = fs::read_to_string(&conn_path) {
                    let snippet_text = ast_service.skeletonize_file(&conn_path, &content);
                    let rel_path = conn_path.strip_prefix(cwd).unwrap_or(&conn_path);

                    candidates.push(ContextSnippet {
                        path: rel_path.to_path_buf(),
                        range: LineRange {
                            start_line: 1,
                            end_line: snippet_text.lines().count() as u32,
                        },
                        content: snippet_text,
                        score,
                        reason: "Direct Dependency (Skeletonized)".to_string(),
                    });
                }
            }
        }

        // 6. Top Recency Bias Files
        let top_recent = recency.top_recent_files(5);
        for rec_path in top_recent {
            if recency.active_file() == Some(&rec_path) {
                continue;
            }

            let rec_score = recency.calculate_score(&rec_path, now);
            if rec_score < 0.2 {
                continue;
            }

            if let Ok(content) = fs::read_to_string(&rec_path) {
                let snippet_text = ast_service.skeletonize_file(&rec_path, &content);
                let rel_path = rec_path.strip_prefix(cwd).unwrap_or(&rec_path);

                candidates.push(ContextSnippet {
                    path: rel_path.to_path_buf(),
                    range: LineRange {
                        start_line: 1,
                        end_line: snippet_text.lines().count() as u32,
                    },
                    content: snippet_text,
                    score: rec_score,
                    reason: "Recently Focused File (Skeletonized)".to_string(),
                });
            }
        }

        // An explicitly named crate is a hard context boundary. Editor focus,
        // diagnostics and git recency outside it must not override user intent.
        if !explicit_scopes.is_empty() {
            candidates.retain(|snippet| path_is_in_scopes(&snippet.path, cwd, &explicit_scopes));

            // Seed the scoped context even when the user has another file open.
            for scope in &explicit_scopes {
                for relative in ["Cargo.toml", "src/lib.rs", "src/main.rs"] {
                    let path = cwd.join(scope).join(relative);
                    if !path.is_file() {
                        continue;
                    }
                    let Ok(content) = fs::read_to_string(&path) else {
                        continue;
                    };
                    let snippet_text = if relative.ends_with(".rs") {
                        ast_service.skeletonize_file(&path, &content)
                    } else {
                        content
                    };
                    let rel_path = path.strip_prefix(cwd).unwrap_or(&path).to_path_buf();
                    if candidates.iter().any(|snippet| snippet.path == rel_path) {
                        continue;
                    }
                    candidates.push(ContextSnippet {
                        path: rel_path,
                        range: LineRange {
                            start_line: 1,
                            end_line: snippet_text.lines().count() as u32,
                        },
                        content: snippet_text,
                        score: 0.98,
                        reason: "Explicit User Scope Entry Point".to_string(),
                    });
                }
            }
        }

        // Semantic Search Boost
        if let Some(query) = user_query {
            let terms: Vec<String> = query
                .to_lowercase()
                .split_whitespace()
                .map(|s| s.to_string())
                .collect();
            for snippet in &mut candidates {
                let content_lower = snippet.content.to_lowercase();
                let mut match_count = 0;
                for term in &terms {
                    if content_lower.contains(term) {
                        match_count += 1;
                    }
                }
                if match_count > 0 {
                    snippet.score += 0.1 * (match_count as f32);
                    snippet.reason.push_str(" (Semantic Match Boost)");
                }
            }
        }

        // Deduplication (Range Merging)
        let mut grouped: std::collections::HashMap<std::path::PathBuf, Vec<ContextSnippet>> =
            std::collections::HashMap::new();
        for snip in candidates {
            grouped.entry(snip.path.clone()).or_default().push(snip);
        }

        let mut deduplicated: Vec<ContextSnippet> = Vec::new();
        for (path, mut snippets) in grouped {
            snippets.sort_by_key(|s| s.range.start_line);

            let mut merged = Vec::new();
            let mut iter = snippets.into_iter();
            if let Some(mut current) = iter.next() {
                for next in iter {
                    if next.range.start_line <= current.range.end_line + 5 {
                        current.range.end_line = current.range.end_line.max(next.range.end_line);
                        current.score = current.score.max(next.score);
                        if !current.reason.contains(&next.reason) {
                            current.reason = format!("{} | {}", current.reason, next.reason);
                        }

                        let abs_path = cwd.join(&path);
                        if let Ok(file_content) = fs::read_to_string(&abs_path) {
                            let lines: Vec<&str> = file_content.lines().collect();
                            current.content = self.extract_lines(
                                &lines,
                                current.range.start_line,
                                current.range.end_line,
                            );
                        } else {
                            current.content.push_str("\n...\n");
                            current.content.push_str(&next.content);
                        }
                    } else {
                        merged.push(current);
                        current = next;
                    }
                }
                merged.push(current);
            }
            deduplicated.extend(merged);
        }

        let mut candidates = deduplicated;

        // Sort candidates by score descending
        candidates.sort_by(|a, b| {
            b.score
                .partial_cmp(&a.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        // Smart Budget Allocator (Bucketing and Smart Truncation)
        let mut selected = Vec::new();
        let max_chars = self.config.max_token_budget * 4; // ~4 chars per token heuristic
        let max_snippet_size = max_chars / 3; // Cap single snippet to 1/3 of total budget

        let mut used_chars = 0;

        for mut snippet in candidates {
            if used_chars >= max_chars {
                break;
            }

            let mut snippet_len = snippet.content.len();
            let mut limit = max_chars.saturating_sub(used_chars).min(max_snippet_size);

            // Allow rules or explicit selection to bypass the 1/3 cap if there's global budget
            if snippet.score >= 1.0 {
                limit = max_chars.saturating_sub(used_chars);
            }

            if snippet_len > limit {
                // Smart truncation at newline
                let mut truncate_at = limit;
                if let Some(last_newline) = snippet.content[..limit].rfind('\n') {
                    truncate_at = last_newline;
                }
                snippet.content.truncate(truncate_at);
                snippet
                    .content
                    .push_str("\n... (truncated due to context size)");
                snippet_len = snippet.content.len();
            }

            used_chars += snippet_len;
            selected.push(snippet);
        }

        selected
    }

    pub fn format_prompt_section(&self, snippets: &[ContextSnippet]) -> String {
        if snippets.is_empty() {
            return String::new();
        }

        let mut out = String::from("\n=== DYNAMIC SMART CONTEXT (SCG2) ===\n");
        out.push_str("Below is the real-time editor state and context automatically collected from user focus:\n\n");

        for (idx, snippet) in snippets.iter().enumerate() {
            out.push_str(&format!(
                "Snippet #{} [{:.2}]\nPath: {} (Lines {}-{})\nReason: {}\n```\n{}\n```\n\n",
                idx + 1,
                snippet.score,
                snippet.path.display(),
                snippet.range.start_line,
                snippet.range.end_line,
                snippet.reason,
                snippet.content.trim_end()
            ));
        }

        out.push_str("=== END DYNAMIC SMART CONTEXT ===\n");
        out
    }

    fn extract_lines(&self, lines: &[&str], start_1based: u32, end_1based: u32) -> String {
        let start_idx = start_1based.saturating_sub(1) as usize;
        let end_idx = end_1based as usize;

        let slice = if start_idx < lines.len() {
            &lines[start_idx..end_idx.min(lines.len())]
        } else {
            &[]
        };

        slice.join("\n")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::diagnostics::DiagnosticsStore;
    use crate::graph::ContextGraph;
    use crate::recency::RecencyStore;
    use crate::types::EditorEventBatch;

    #[test]
    fn detects_explicit_crate_scope_in_english_and_russian() {
        let dir = tempfile::tempdir().unwrap();
        fs::create_dir_all(dir.path().join("crates/git")).unwrap();
        fs::create_dir_all(dir.path().join("crates/agent")).unwrap();

        assert_eq!(
            detect_explicit_crate_scopes(dir.path(), "Explain only the git crate"),
            vec![std::path::PathBuf::from("crates/git")]
        );
        assert_eq!(
            detect_explicit_crate_scopes(dir.path(), "Подробно объясни крейт git, только его"),
            vec![std::path::PathBuf::from("crates/git")]
        );
    }

    #[test]
    fn explicit_crate_scope_excludes_unrelated_editor_context() {
        let dir = tempfile::tempdir().unwrap();
        let git_dir = dir.path().join("crates/git");
        let frontend = dir.path().join("src/frontend.ts");
        fs::create_dir_all(git_dir.join("src")).unwrap();
        fs::create_dir_all(frontend.parent().unwrap()).unwrap();
        fs::write(git_dir.join("Cargo.toml"), "[package]\nname = \"git\"\n").unwrap();
        fs::write(git_dir.join("src/lib.rs"), "pub fn status() {}\n").unwrap();
        fs::write(&frontend, "export const unrelated = true;\n").unwrap();

        let config = Scg2Config::default();
        let mut recency = RecencyStore::new(config.clone());
        recency.process_batch(&EditorEventBatch {
            active_file: Some(frontend),
            cursor: None,
            visible_ranges: Vec::new(),
            selection: None,
            diagnostics: Vec::new(),
            is_edit: false,
            timestamp_ms: 0,
            hovered_word: None,
        });

        let snippets = ContextAssembler::new(config).assemble_context(
            &recency,
            &ContextGraph::new(),
            &DiagnosticsStore::new(),
            dir.path(),
            Some("Объясни только крейт git"),
        );

        assert!(!snippets.is_empty());
        assert!(snippets
            .iter()
            .all(|snippet| snippet.path.starts_with("crates/git")));
        assert!(snippets
            .iter()
            .any(|snippet| snippet.path == Path::new("crates/git/src/lib.rs")));
    }
}
