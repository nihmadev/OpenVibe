use crate::types::{ContextSnippet, EditorDiagnostic, LineRange};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub struct DiagnosticsStore {
    diagnostics_by_file: HashMap<PathBuf, Vec<EditorDiagnostic>>,
}

impl Default for DiagnosticsStore {
    fn default() -> Self {
        Self::new()
    }
}

impl DiagnosticsStore {
    pub fn new() -> Self {
        Self {
            diagnostics_by_file: HashMap::new(),
        }
    }

    pub fn update_diagnostics(&mut self, active_file: Option<&PathBuf>, diagnostics: Vec<EditorDiagnostic>) {
        if let Some(file) = active_file {
            if diagnostics.is_empty() {
                self.diagnostics_by_file.remove(file);
            } else {
                self.diagnostics_by_file.insert(file.clone(), diagnostics);
            }
        }
    }

    pub fn get_diagnostic_snippets(&self, cwd: &Path) -> Vec<ContextSnippet> {
        let mut snippets = Vec::new();

        for (path, diags) in &self.diagnostics_by_file {
            let errors: Vec<&EditorDiagnostic> = diags
                .iter()
                .filter(|d| d.severity.to_lowercase() == "error" || d.severity.to_lowercase() == "warning")
                .collect();

            if errors.is_empty() {
                continue;
            }

            let rel_path = path.strip_prefix(cwd).unwrap_or(path);
            let mut text = String::from("COMPILER/LINTER DIAGNOSTICS DETECTED:\n");
            let mut min_line = u32::MAX;
            let mut max_line = 1u32;

            for d in &errors {
                min_line = min_line.min(d.start_line);
                max_line = max_line.max(d.end_line);
                text.push_str(&format!(
                    "- [{}] Line {}:{}: {}\n",
                    d.severity.to_uppercase(),
                    d.start_line,
                    d.start_line,
                    d.message
                ));
            }

            snippets.push(ContextSnippet {
                path: rel_path.to_path_buf(),
                range: LineRange {
                    start_line: min_line.min(1),
                    end_line: max_line,
                },
                content: text,
                score: 0.95,
                reason: "Active Compiler/Linter Error Diagnostics".to_string(),
            });
        }

        snippets
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_diagnostics_snippets() {
        let mut store = DiagnosticsStore::new();
        let file = PathBuf::from("/test/src/lib.rs");

        store.update_diagnostics(
            Some(&file),
            vec![EditorDiagnostic {
                message: "cannot find value `foo`".to_string(),
                severity: "error".to_string(),
                start_line: 12,
                end_line: 12,
                file_path: Some(file.clone()),
            }],
        );

        let snippets = store.get_diagnostic_snippets(Path::new("/test"));
        assert_eq!(snippets.len(), 1);
        assert_eq!(snippets[0].score, 0.95);
        assert!(snippets[0].content.contains("cannot find value `foo`"));
    }
}
