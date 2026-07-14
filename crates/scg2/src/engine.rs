use crate::assembler::ContextAssembler;
use crate::ast::AstService;
use crate::diagnostics::DiagnosticsStore;
use crate::graph::ContextGraph;
use crate::recency::RecencyStore;
use crate::types::{ContextSnippet, EditorEventBatch, Scg2Config};
use parking_lot::Mutex;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::debug;

pub struct Scg2Engine {
    recency: Arc<Mutex<RecencyStore>>,
    graph: Arc<Mutex<ContextGraph>>,
    diagnostics: Arc<Mutex<DiagnosticsStore>>,
    assembler: ContextAssembler,
    _config: Scg2Config,
    tx_events: mpsc::Sender<EditorEventBatch>,
    rx_events: Mutex<Option<mpsc::Receiver<EditorEventBatch>>>,
}

impl Scg2Engine {
    pub fn new(config: Scg2Config) -> Self {
        let recency = Arc::new(Mutex::new(RecencyStore::new(config.clone())));
        let graph = Arc::new(Mutex::new(ContextGraph::new()));
        let diagnostics = Arc::new(Mutex::new(DiagnosticsStore::new()));
        let assembler = ContextAssembler::new(config.clone());

        let (tx_events, rx_events) = mpsc::channel::<EditorEventBatch>(256);

        Self {
            recency,
            graph,
            diagnostics,
            assembler,
            _config: config,
            tx_events,
            rx_events: Mutex::new(Some(rx_events)),
        }
    }

    pub async fn start_background_worker(&self) {
        let mut rx_events = match self.rx_events.lock().take() {
            Some(rx) => rx,
            None => return,
        };

        let mut ast_service = AstService::new();
        let recency = self.recency.clone();
        let graph = self.graph.clone();
        let diagnostics_store = self.diagnostics.clone();

        let mut pending_parse: Option<std::path::PathBuf> = None;

        loop {
            let timeout_duration = std::time::Duration::from_millis(500);

            match tokio::time::timeout(timeout_duration, rx_events.recv()).await {
                Ok(Some(batch)) => {
                    // Update recency store
                    recency.lock().process_batch(&batch);

                    // Update diagnostics store
                    diagnostics_store
                        .lock()
                        .update_diagnostics(batch.active_file.as_ref(), batch.diagnostics);

                    if let Some(word) = batch.hovered_word {
                        let g = graph.lock();
                        let defs = g.find_symbol_definitions(&word);
                        let mut r = recency.lock();
                        for def in defs {
                            r.boost_file(&def.file_path);
                        }
                    }

                    // If active file was updated or content edited, schedule re-parse
                    if let Some(active_file) = batch.active_file {
                        let g = graph.lock();
                        let needs_parse = batch.is_edit || g.get_connected_files(&active_file, 0).is_empty();
                        if needs_parse {
                            pending_parse = Some(active_file);
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => {
                    if let Some(active_file) = pending_parse.take() {
                        if active_file.exists() && active_file.is_file() {
                            match fs::read_to_string(&active_file) {
                                Ok(content) => {
                                    let (symbols, imports) = ast_service.parse_file(&active_file, &content);
                                    let imports_count = imports.imported_modules.len();
                                    graph
                                        .lock()
                                        .update_file_symbols(&active_file, symbols, imports.imported_modules);
                                    debug!("Parsed AST for {} (found {} imports)", active_file.display(), imports_count);
                                }
                                Err(err) => {
                                    debug!("Failed to read file for SCG2 AST parse {}: {}", active_file.display(), err);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    pub fn push_batch(&self, batch: EditorEventBatch) {
        if let Err(e) = self.tx_events.try_send(batch) {
            debug!("SCG2 event queue full or dropped: {}", e);
        }
    }

    pub fn get_smart_snippets(&self, cwd: &Path, query: Option<&str>) -> Vec<ContextSnippet> {
        let recency_guard = self.recency.lock();
        let graph_guard = self.graph.lock();
        let diag_guard = self.diagnostics.lock();

        self.assembler
            .assemble_context(&recency_guard, &graph_guard, &diag_guard, cwd, query)
    }

    pub fn get_smart_context(&self, cwd: &Path, query: Option<&str>) -> String {
        let snippets = self.get_smart_snippets(cwd, query);
        self.assembler.format_prompt_section(&snippets)
    }
}
