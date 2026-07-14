use crate::types::{CursorPosition, EditorEventBatch, LineRange, Scg2Config, SelectionRange};
use std::collections::{HashMap, VecDeque};
use std::path::{Path, PathBuf};
use std::time::Instant;

/// Metrics and telemetry access history recorded for an individual workspace file.
#[derive(Debug, Clone)]
pub struct FileAccessEntry {
    /// Absolute or relative path to the tracked file.
    pub path: PathBuf,
    /// Instant when the file was last focused or mutated.
    pub last_accessed: Instant,
    /// Cumulative duration (in seconds) the editor focused this file.
    pub total_focus_time_secs: f32,
    /// Last known cursor position within the file.
    pub active_cursor: Option<CursorPosition>,
    /// Last active text selection range within the file.
    pub active_selection: Option<SelectionRange>,
    /// Lines currently visible in the active viewport.
    pub visible_ranges: Vec<LineRange>,
    /// Total number of editing actions performed in this file session.
    pub edit_count: u32,
}

/// In-memory cache and LRU queue managing recency metrics, focus tracking, and exponential score decay.
pub struct RecencyStore {
    entries: HashMap<PathBuf, FileAccessEntry>,
    recent_order: VecDeque<PathBuf>,
    active_file: Option<PathBuf>,
    config: Scg2Config,
}

impl RecencyStore {
    pub fn new(config: Scg2Config) -> Self {
        Self {
            entries: HashMap::new(),
            recent_order: VecDeque::new(),
            active_file: None,
            config,
        }
    }

    pub fn process_batch(&mut self, batch: &EditorEventBatch) {
        let now = Instant::now();

        if let Some(ref path) = batch.active_file {
            self.active_file = Some(path.clone());
            let entry = self
                .entries
                .entry(path.clone())
                .or_insert_with(|| FileAccessEntry {
                    path: path.clone(),
                    last_accessed: now,
                    total_focus_time_secs: 0.0,
                    active_cursor: None,
                    active_selection: None,
                    visible_ranges: Vec::new(),
                    edit_count: 0,
                });

            let elapsed = now.duration_since(entry.last_accessed).as_secs_f32();
            if elapsed < 300.0 {
                entry.total_focus_time_secs += elapsed;
            }
            entry.last_accessed = now;

            if let Some(ref cursor) = batch.cursor {
                entry.active_cursor = Some(cursor.clone());
            }

            entry.active_selection = batch.selection.clone();

            if !batch.visible_ranges.is_empty() {
                entry.visible_ranges = batch.visible_ranges.clone();
            }

            if batch.is_edit {
                entry.edit_count += 1;
            }

            // Update recent order
            self.recent_order.retain(|p| p != path);
            self.recent_order.push_front(path.clone());

            // Evict overflow
            while self.recent_order.len() > self.config.max_recency_entries {
                if let Some(evicted) = self.recent_order.pop_back() {
                    self.entries.remove(&evicted);
                }
            }
        }
    }

    pub fn boost_file(&mut self, path: &Path) {
        let now = Instant::now();
        let entry = self
            .entries
            .entry(path.to_path_buf())
            .or_insert_with(|| FileAccessEntry {
                path: path.to_path_buf(),
                last_accessed: now,
                total_focus_time_secs: 0.0,
                active_cursor: None,
                active_selection: None,
                visible_ranges: Vec::new(),
                edit_count: 0,
            });

        // Faking focus time increase for boost
        entry.total_focus_time_secs += 60.0;
        entry.last_accessed = now;

        self.recent_order.retain(|p| p != path);
        self.recent_order.push_front(path.to_path_buf());

        while self.recent_order.len() > self.config.max_recency_entries {
            if let Some(evicted) = self.recent_order.pop_back() {
                self.entries.remove(&evicted);
            }
        }
    }

    pub fn active_file(&self) -> Option<&PathBuf> {
        self.active_file.as_ref()
    }

    pub fn get_entry(&self, path: &Path) -> Option<&FileAccessEntry> {
        self.entries.get(path)
    }

    pub fn calculate_score(&self, path: &Path, now: Instant) -> f32 {
        let entry = match self.entries.get(path) {
            Some(e) => e,
            None => return 0.0,
        };

        let is_active = self.active_file.as_ref().is_some_and(|p| p == path);
        let active_weight = if is_active { 1.0 } else { 0.0 };

        let elapsed = now.duration_since(entry.last_accessed).as_secs_f32();

        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        let is_config = file_name == "Cargo.toml"
            || file_name == ".viberules"
            || file_name == "package.json"
            || file_name == "tsconfig.json";
        let decay_multiplier = if is_config { 5.0 } else { 1.0 };

        let lambda = (2.0f32).ln() / (self.config.decay_half_life_secs.max(1.0) * decay_multiplier);
        let recency_weight = (-lambda * elapsed).exp();

        let edit_weight = (1.0 + entry.edit_count as f32).ln();

        0.5 * active_weight + 0.3 * recency_weight + 0.2 * edit_weight.min(2.0)
    }

    pub fn top_recent_files(&self, limit: usize) -> Vec<PathBuf> {
        self.recent_order.iter().take(limit).cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recency_store_active_file() {
        let mut store = RecencyStore::new(Scg2Config::default());
        let file = PathBuf::from("/test/src/main.rs");

        let batch = EditorEventBatch {
            active_file: Some(file.clone()),
            cursor: Some(CursorPosition {
                line: 10,
                column: 5,
            }),
            visible_ranges: vec![LineRange {
                start_line: 1,
                end_line: 25,
            }],
            selection: None,
            diagnostics: vec![],
            is_edit: true,
            timestamp_ms: 1000,
            hovered_word: None,
        };

        store.process_batch(&batch);

        assert_eq!(store.active_file(), Some(&file));
        let entry = store.get_entry(&file).unwrap();
        assert_eq!(entry.edit_count, 1);
        assert_eq!(
            entry.active_cursor,
            Some(CursorPosition {
                line: 10,
                column: 5
            })
        );

        let score = store.calculate_score(&file, Instant::now());
        assert!(score > 0.5);
    }

    #[test]
    fn test_recency_eviction() {
        let mut config = Scg2Config::default();
        config.max_recency_entries = 2;
        let mut store = RecencyStore::new(config);

        store.process_batch(&EditorEventBatch {
            active_file: Some(PathBuf::from("/f1.rs")),
            cursor: None,
            visible_ranges: vec![],
            selection: None,
            diagnostics: vec![],
            is_edit: false,
            timestamp_ms: 0,
            hovered_word: None,
        });

        store.process_batch(&EditorEventBatch {
            active_file: Some(PathBuf::from("/f2.rs")),
            cursor: None,
            visible_ranges: vec![],
            selection: None,
            diagnostics: vec![],
            is_edit: false,
            timestamp_ms: 0,
            hovered_word: None,
        });

        store.process_batch(&EditorEventBatch {
            active_file: Some(PathBuf::from("/f3.rs")),
            cursor: None,
            visible_ranges: vec![],
            selection: None,
            diagnostics: vec![],
            is_edit: false,
            timestamp_ms: 0,
            hovered_word: None,
        });

        assert_eq!(store.top_recent_files(10).len(), 2);
        assert!(store.get_entry(Path::new("/f1.rs")).is_none());
        assert!(store.get_entry(Path::new("/f3.rs")).is_some());
    }
}
