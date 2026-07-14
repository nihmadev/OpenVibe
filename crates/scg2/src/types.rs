use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents a 0-indexed line and column cursor location within a source file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CursorPosition {
    /// 0-indexed line number.
    pub line: u32,
    /// 0-indexed column offset.
    pub column: u32,
}

/// Represents a contiguous inclusive line span within a file.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineRange {
    /// Starting line index (0-indexed).
    pub start_line: u32,
    /// Ending line index (0-indexed).
    pub end_line: u32,
}

/// Represents an active code selection block and its raw text snippet.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectionRange {
    /// Starting line index of selection (0-indexed).
    pub start_line: u32,
    /// Starting column offset of selection (0-indexed).
    pub start_column: u32,
    /// Ending line index of selection (0-indexed).
    pub end_line: u32,
    /// Ending column offset of selection (0-indexed).
    pub end_column: u32,
    /// Exact text content currently highlighted or selected in the editor.
    pub selected_text: String,
}

/// Represents a language server or compiler diagnostic message tied to a specific line span.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorDiagnostic {
    /// Diagnostic description or warning/error message.
    pub message: String,
    /// Severity level string ("error", "warning", "info").
    pub severity: String,
    /// Starting line of the diagnostic marker (0-indexed).
    pub start_line: u32,
    /// Ending line of the diagnostic marker (0-indexed).
    pub end_line: u32,
    /// Relative or absolute path to the associated file.
    #[serde(default)]
    pub file_path: Option<PathBuf>,
}

/// Batched telemetry event snapshot emitted by the frontend workspace to update SCG2 context metrics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorEventBatch {
    /// Path of the currently focused file in the editor workspace.
    pub active_file: Option<PathBuf>,
    /// Active cursor position within the focused document.
    pub cursor: Option<CursorPosition>,
    /// List of line ranges visible in the active viewport.
    pub visible_ranges: Vec<LineRange>,
    /// Active selection range details, if any text is highlighted.
    #[serde(default)]
    pub selection: Option<SelectionRange>,
    /// Compiler or linter diagnostic notifications active in the workspace.
    #[serde(default)]
    pub diagnostics: Vec<EditorDiagnostic>,
    /// Indicates whether this event batch was triggered by a document text mutation.
    #[serde(default)]
    pub is_edit: bool,
    /// Timestamp (Unix epoch in milliseconds) when the snapshot was recorded.
    #[serde(default)]
    pub timestamp_ms: u64,
    /// Token or symbol string currently hovered by the user cursor.
    #[serde(default)]
    pub hovered_word: Option<String>,
}

/// A selected code context snippet scored and prioritized for inclusion in LLM prompt payloads.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSnippet {
    /// Target file path relative to workspace directory root.
    pub path: PathBuf,
    /// Specific line span demarcating the snippet boundary.
    pub range: LineRange,
    /// Source code text payload of the snippet.
    pub content: String,
    /// Relevancy score computed by SCG2 heuristic algorithms (0.0 to 1.0).
    pub score: f32,
    /// Human-readable explanation justifying why this snippet was selected into prompt context.
    pub reason: String,
}

/// Configuration options governing SCG2 token limits and recency decay algorithms.
#[derive(Debug, Clone)]
pub struct Scg2Config {
    /// Maximum character/token allocation allowed for assembled context snippets.
    pub max_token_budget: usize,
    /// Maximum number of file visit entries retained in the recency decay buffer.
    pub max_recency_entries: usize,
    /// Recency decay half-life window specified in seconds (defaults to 300s / 5 minutes).
    pub decay_half_life_secs: f32,
}

impl Default for Scg2Config {
    fn default() -> Self {
        Self {
            max_token_budget: 3000,
            max_recency_entries: 30,
            decay_half_life_secs: 300.0,
        }
    }
}
