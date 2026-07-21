use crate::assembler::ContextAssembler;
use crate::ast::AstService;
use crate::diagnostics::DiagnosticsStore;
use crate::graph::ContextGraph;
use crate::recency::RecencyStore;
use crate::types::{ContextSnippet, EditorEventBatch, Scg2Config};
use parking_lot::Mutex;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::debug;

struct Scg2Cache {
    context: String,
    query: Option<String>,
    generation: u64,
}

/// The central orchestration engine for Smart Context Generation 2 (SCG2).
///
/// `Scg2Engine` manages async background processing of telemetry event batches emitted by editor sessions,
/// coordinates AST symbol indexing, maintains recency decay state, and provides dynamic prompt context assembly.
pub struct Scg2Engine {
    recency: Arc<Mutex<RecencyStore>>,
    graph: Arc<Mutex<ContextGraph>>,
    diagnostics: Arc<Mutex<DiagnosticsStore>>,
    assembler: ContextAssembler,
    _config: Scg2Config,
    tx_events: mpsc::Sender<EditorEventBatch>,
    rx_events: Mutex<Option<mpsc::Receiver<EditorEventBatch>>>,
    generation: AtomicU64,
    cache: Mutex<Option<Scg2Cache>>,
}

impl Scg2Engine {
    /// Constructs a new `Scg2Engine` instance initialized with the provided configuration limits.
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
            generation: AtomicU64::new(0),
            cache: Mutex::new(None),
        }
    }

    /// Spawns the main background loop consuming incoming telemetry batches and debouncing AST re-parsing.
    ///
    /// The event processing queue uses a 500ms timeout window to aggregate high-frequency UI events
    /// before triggering tree-sitter syntax tree updates.
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
                    // Update recency scoring metrics from incoming telemetry batch
                    recency.lock().process_batch(&batch);

                    // Synchronize compiler/linter error and warning diagnostics
                    diagnostics_store
                        .lock()
                        .update_diagnostics(batch.active_file.as_ref(), batch.diagnostics);

                    // Boost relevancy rank for symbol definitions matching active cursor hover state
                    if let Some(word) = batch.hovered_word {
                        let g = graph.lock();
                        let defs = g.find_symbol_definitions(&word);
                        let mut r = recency.lock();
                        for def in defs {
                            r.boost_file(&def.file_path);
                        }
                    }

                    // Schedule debounced AST re-indexing if file active state changed or file content mutated
                    if let Some(active_file) = batch.active_file {
                        let g = graph.lock();
                        let needs_parse =
                            batch.is_edit || g.get_connected_files(&active_file, 0).is_empty();
                        if needs_parse {
                            pending_parse = Some(active_file);
                        }
                    }
                }
                Ok(None) => break,
                Err(_) => {
                    // Timeout elapsed: process debounced pending AST parse task
                    if let Some(active_file) = pending_parse.take() {
                        if active_file.exists() && active_file.is_file() {
                            match fs::read_to_string(&active_file) {
                                Ok(content) => {
                                    let (symbols, imports) =
                                        ast_service.parse_file(&active_file, &content);
                                    let imports_count = imports.imported_modules.len();
                                    graph.lock().update_file_symbols(
                                        &active_file,
                                        symbols,
                                        imports.imported_modules,
                                    );
                                    debug!(
                                        "Parsed AST for {} (found {} imports)",
                                        active_file.display(),
                                        imports_count
                                    );
                                }
                                Err(err) => {
                                    debug!(
                                        "Failed to read file for SCG2 AST parse {}: {}",
                                        active_file.display(),
                                        err
                                    );
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /// Submits a non-blocking telemetry event batch into the background worker channel.
    pub fn push_batch(&self, batch: EditorEventBatch) {
        if let Err(e) = self.tx_events.try_send(batch) {
            debug!("SCG2 event queue full or dropped: {}", e);
        }
        self.generation.fetch_add(1, Ordering::Release);
    }

    /// Evaluates workspace state heuristics and compiles a list of top-scored `ContextSnippet` instances.
    pub fn get_smart_snippets(&self, cwd: &Path, query: Option<&str>) -> Vec<ContextSnippet> {
        let recency_guard = self.recency.lock();
        let graph_guard = self.graph.lock();
        let diag_guard = self.diagnostics.lock();

        self.assembler
            .assemble_context(&recency_guard, &graph_guard, &diag_guard, cwd, query)
    }

    /// Evaluates workspace state heuristics and formats selected code snippets into a markdown system prompt block.
    pub fn get_smart_context(&self, cwd: &Path, query: Option<&str>) -> String {
        let current_gen = self.generation.load(Ordering::Acquire);
        {
            let cache_lock = self.cache.lock();
            if let Some(ref cached) = *cache_lock {
                if cached.generation == current_gen && cached.query.as_deref() == query {
                    return cached.context.clone();
                }
            }
        }
        let snippets = self.get_smart_snippets(cwd, query);
        let context = self.assembler.format_prompt_section(&snippets);
        let mut cache_lock = self.cache.lock();
        *cache_lock = Some(Scg2Cache {
            context: context.clone(),
            query: query.map(String::from),
            generation: current_gen,
        });
        context
    }
}
