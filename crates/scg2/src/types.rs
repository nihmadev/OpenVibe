use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CursorPosition {
    pub line: u32,
    pub column: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineRange {
    pub start_line: u32,
    pub end_line: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectionRange {
    pub start_line: u32,
    pub start_column: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub selected_text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorDiagnostic {
    pub message: String,
    pub severity: String,
    pub start_line: u32,
    pub end_line: u32,
    #[serde(default)]
    pub file_path: Option<PathBuf>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorEventBatch {
    pub active_file: Option<PathBuf>,
    pub cursor: Option<CursorPosition>,
    pub visible_ranges: Vec<LineRange>,
    #[serde(default)]
    pub selection: Option<SelectionRange>,
    #[serde(default)]
    pub diagnostics: Vec<EditorDiagnostic>,
    #[serde(default)]
    pub is_edit: bool,
    #[serde(default)]
    pub timestamp_ms: u64,
    #[serde(default)]
    pub hovered_word: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnippet {
    pub path: PathBuf,
    pub range: LineRange,
    pub content: String,
    pub score: f32,
    pub reason: String,
}

#[derive(Debug, Clone)]
pub struct Scg2Config {
    pub max_token_budget: usize,
    pub max_recency_entries: usize,
    pub decay_half_life_secs: f32,
}

impl Default for Scg2Config {
    fn default() -> Self {
        Self {
            max_token_budget: 3000,
            max_recency_entries: 30,
            decay_half_life_secs: 300.0, // 5 minutes
        }
    }
}
