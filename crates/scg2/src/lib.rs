pub mod assembler;
pub mod ast;
pub mod diagnostics;
pub mod engine;
pub mod git_delta;
pub mod graph;
pub mod recency;
pub mod types;

pub use engine::Scg2Engine;
pub use types::{ContextSnippet, CursorPosition, EditorDiagnostic, EditorEventBatch, LineRange, Scg2Config, SelectionRange};
