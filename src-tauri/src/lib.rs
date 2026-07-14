mod commands;
mod http_client;

use config::{load_config, Config};

use chats::ChatStore;
use notify::{Config as NotifyConfig, Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::watch;

pub struct AppState {
    pub projects: Mutex<db::ProjectStore>,
    pub chat_store: Mutex<Option<chats::ChatStore>>,
    pub terminals: Mutex<terminal::manager::TerminalManager>,
    pub config: Mutex<Option<Config>>,
    pub active_chat_id: Mutex<Option<String>>,
    pub app_handle: Mutex<Option<AppHandle>>,
    pub llm_cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub agent: Mutex<Option<agent::Agent>>,
    pub agent_cancel: Mutex<Option<Arc<AtomicBool>>>,
    pub http_client: reqwest::Client,
    pub provider_url: Arc<tokio::sync::Mutex<String>>,
    pub warmer_stop_tx: Mutex<Option<watch::Sender<bool>>>,
    pub mcp_manager: Arc<mcp::McpManager>,
    pub scg2_engine: Arc<scg2::Scg2Engine>,
}

impl AppState {
    pub fn switch_to_project(&self, cwd: &str, project_id: &str) {
        // Update config cwd
        if let Ok(mut config) = self.config.lock() {
            if let Some(ref mut c) = *config {
                c.cwd = cwd.to_string();
            }
        }

        // Kill all terminals
        if let Ok(terminals) = self.terminals.lock() {
            terminals.kill_all();
        }

        // Create new terminal manager with new cwd
        if let Ok(mut terminals) = self.terminals.lock() {
            *terminals = terminal::manager::TerminalManager::new(cwd);
        }

        // Update chat store
        if let Ok(projects) = self.projects.lock() {
            let db_path = projects.chats_db(project_id);
            if let Ok(new_store) = ChatStore::new(&db_path) {
                if let Ok(mut chat) = self.chat_store.lock() {
                    *chat = Some(new_store);
                }
            }
        }

        // Reset active chat
        if let Ok(mut active) = self.active_chat_id.lock() {
            *active = None;
        }

        // Setup file watcher
        self.setup_watcher(cwd);
    }

    pub fn reset_project_state(&self) {
        if let Ok(mut chat) = self.chat_store.lock() {
            *chat = None;
        }
        if let Ok(mut active) = self.active_chat_id.lock() {
            *active = None;
        }
    }

    pub fn persist_active_chat(&self) -> Result<(), String> {
        // Frontend handles persistence via event emission
        // This is a no-op in the Rust backend since messages live on frontend
        Ok(())
    }

    fn setup_watcher(&self, path: &str) {
        let app = self.app_handle.lock().ok().and_then(|h| h.clone());
        if app.is_none() {
            return;
        }

        let path = path.to_string();
        std::thread::spawn(move || {
            let (tx, rx) = std::sync::mpsc::channel::<Result<Event, notify::Error>>();

            let mut watcher = match RecommendedWatcher::new(tx, NotifyConfig::default()) {
                Ok(w) => w,
                Err(_) => return,
            };

            if watcher.watch(Path::new(&path), RecursiveMode::Recursive).is_err() {
                return;
            }

            let ignored = [
                "node_modules",
                ".git",
                "dist",
                "build",
                ".next",
                "out",
                ".cache",
                ".turbo",
                "coverage",
                ".vite",
                "target",
                "__pycache__/",
                "vendor/",
            ];

            // Trailing-edge debounce: emit only after a quiet period (no events for 300ms)
            let mut changed_paths: Vec<String> = Vec::new();
            let quiet = std::time::Duration::from_millis(300);

            loop {
                match rx.recv_timeout(quiet) {
                    Ok(Ok(event)) => {
                        // Filter ignored paths
                        let should_ignore = event.paths.iter().any(|p| {
                            let p_str = p.to_string_lossy();
                            ignored
                                .iter()
                                .any(|i| p_str.contains(&format!("\\{}\\", i)) || p_str.contains(&format!("/{}/", i)))
                        });
                        if should_ignore {
                            continue;
                        }

                        for p in event.paths {
                            changed_paths.push(p.to_string_lossy().to_string());
                        }
                    }
                    Ok(Err(_)) => break,
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        if !changed_paths.is_empty() {
                            if let Some(ref handle) = app {
                                let paths = std::mem::take(&mut changed_paths);
                                let _ = handle.emit("vibe:fs:changed", paths);
                            }
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .setup(move |app| {
            // Initialize project store
            let data_dir = dirs::data_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).join("openvibe");
            let data_dir_str = data_dir.to_string_lossy().to_string();

            let project_store = db::ProjectStore::new(&data_dir_str).expect("Failed to initialize project store");

            // Get initial project
            let (initial_cwd, initial_project_id) = {
                let active = project_store.get_active();
                match active {
                    Ok(Some(ref p)) if Path::new(&p.path).exists() => (p.path.clone(), Some(p.id.clone())),
                    _ => (String::new(), None),
                }
            };

            // Load config from project root
            let mut cfg = load_config(&initial_cwd);

            // Setup config with initial cwd
            cfg.cwd = initial_cwd.clone();

            // If config has no api_key, try loading from a provider in DB
            if cfg.api_key.is_empty() {
                let providers = project_store.list_providers().unwrap_or_default();
                // Prefer matching by provider_id, otherwise take the most recently added
                let active_provider = cfg
                    .provider_id
                    .as_ref()
                    .and_then(|pid| providers.iter().find(|p| p.id == *pid))
                    .or_else(|| providers.last());
                if let Some(p) = active_provider {
                    cfg.api_key = p.api_key.clone();
                    cfg.base_url = p.base_url.clone();
                    cfg.model = p.model.clone();
                    cfg.provider_id = Some(p.id.clone());
                }
            }

            // Setup chat store if project exists
            let chat_store = initial_project_id
                .as_ref()
                .and_then(|pid| {
                    let db_path = project_store.chats_db(pid);
                    ChatStore::new(&db_path).ok()
                });

            // Setup terminal manager
            let term_mgr = terminal::manager::TerminalManager::new(&initial_cwd);

            let app_handle = app.handle().clone();

            // Initialize optimized HTTP client pool (HTTP/2, TCP keep-alive, low latency)
            let shared_client = http_client::create_shared_client();
            let provider_url = Arc::new(tokio::sync::Mutex::new(cfg.base_url.clone()));
            let (warmer_stop_tx, warmer_stop_rx) = watch::channel(false);

            // Spawn background task to keep provider TCP/TLS connections warm
            http_client::spawn_connection_warmer(shared_client.clone(), provider_url.clone(), warmer_stop_rx);

            // MCP Manager
            let mcp_config_path = mcp::resolve_config_path(&initial_cwd);

            let mcp_manager = Arc::new(mcp::McpManager::new(mcp_config_path));
            let mcp_clone = mcp_manager.clone();
            tauri::async_runtime::spawn(async move {
                mcp_clone.init_and_autostart().await;
            });

            // SCG2 Engine
            let scg2_engine = Arc::new(scg2::Scg2Engine::new(scg2::Scg2Config::default()));
            let scg2_clone = scg2_engine.clone();
            tauri::async_runtime::spawn(async move {
                scg2_clone.start_background_worker().await;
            });

            // Create state
            let state = AppState {
                projects: Mutex::new(project_store),
                chat_store: Mutex::new(chat_store),
                terminals: Mutex::new(term_mgr),
                config: Mutex::new(Some(cfg)),
                active_chat_id: Mutex::new(None),
                app_handle: Mutex::new(Some(app_handle.clone())),
                llm_cancels: Mutex::new(HashMap::new()),
                agent: Mutex::new(None),
                agent_cancel: Mutex::new(None),
                http_client: shared_client,
                provider_url,
                warmer_stop_tx: Mutex::new(Some(warmer_stop_tx)),
                mcp_manager,
                scg2_engine,
            };

            // Setup watcher if cwd exists
            if Path::new(&initial_cwd).exists() {
                state.setup_watcher(&initial_cwd);
            }

            app.manage(state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Agent commands
            commands::agent::agent_new,
            commands::agent::agent_send,
            commands::agent::agent_stop,
            commands::agent::agent_reset,
            commands::agent::agent_summarize,
            commands::agent::agent_set_messages,
            commands::agent::agent_get_messages,
            commands::agent::agent_instant_revert,
            commands::agent::agent_revert_preview,
            commands::agent::agent_revert_undo,
            commands::agent::agent_set_cwd,
            commands::agent::agent_set_provider,
            commands::agent::agent_get_sub_trace,
            // FS commands
            commands::fs::fs_list,
            commands::fs::fs_read,
            commands::fs::fs_read_binary,
            commands::fs::fs_write,
            commands::fs::fs_rename,
            commands::fs::fs_delete,
            commands::fs::fs_create_file,
            commands::fs::fs_create_dir,
            commands::fs::fs_find,
            commands::fs::fs_find_all,
            commands::fs::fs_search_content,
            commands::fs::fs_search_content_filter,
            commands::fs::fs_search_content_files,
            commands::fs::fs_search_content_file_matches,
            commands::fs::fs_highlight_lines,
            commands::fs::fs_project_info,
            commands::fs::whisper_transcribe,
            // Editor commands
            commands::editor::editor_preload_types,
            // Project commands
            commands::projects::projects_list,
            commands::projects::projects_active,
            commands::projects::projects_add,
            commands::projects::projects_set_active,
            commands::projects::projects_remove,
            commands::projects::projects_rename,
            commands::projects::projects_close,
            commands::projects::projects_set_color,
            commands::projects::projects_set_icon,
            commands::projects::projects_set_photo,
            // Chat commands
            commands::chats::chats_list,
            commands::chats::chats_list_for_project,
            commands::chats::chats_new,
            commands::chats::chats_open,
            commands::chats::chats_delete,
            commands::chats::chats_rename,
            commands::chats::chats_save,
            commands::chats::chats_clear,
            // Provider commands
            commands::providers::providers_list,
            commands::providers::providers_save,
            commands::providers::providers_delete,
            // Model commands
            commands::models::models_fetch,
            commands::models::models_list_disabled,
            commands::models::models_toggle_disabled,
            commands::models::models_list_enabled,
            commands::models::models_toggle_enabled,
            // Git commands
            commands::git::git_repo_info,
            commands::git::git_status,
            commands::git::git_stage_file,
            commands::git::git_stage_all,
            commands::git::git_unstage_file,
            commands::git::git_revert_file,
            commands::git::git_commit,
            commands::git::git_branches,
            commands::git::git_commits,
            commands::git::git_graph,
            commands::git::git_publish_branch,
            commands::git::git_current_branch,
            commands::git::git_commit_details,
            // Terminal commands
            commands::terminals::term_start,
            commands::terminals::term_write,
            commands::terminals::term_resize,
            commands::terminals::term_kill,
            // Misc commands
            commands::misc::init_app,
            commands::misc::read_config,
            commands::misc::window_minimize,
            commands::misc::window_maximize,
            commands::misc::window_close,
            commands::misc::is_maximized,
            commands::misc::get_cwd,
            commands::misc::set_model,
            commands::misc::set_provider,
            commands::misc::window_zoom,
            commands::misc::state_get,
            commands::misc::state_set,
            // LLM commands
            commands::llm::llm_stream,
            commands::llm::llm_abort,
            commands::llm::estimate_context_tokens,
            // Tool commands
            commands::tools::tools_definitions,
            commands::tools::tools_execute,
            // MCP commands
            commands::mcp::mcp_get_servers,
            commands::mcp::mcp_start_server,
            commands::mcp::mcp_stop_server,
            commands::mcp::mcp_restart_server,
            commands::mcp::mcp_get_status,
            commands::mcp::mcp_get_config,
            commands::mcp::mcp_save_config,
            commands::mcp::mcp_list_tools,
            // SCG2 commands
            commands::scg2::scg2_push_events,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
