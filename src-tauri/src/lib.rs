mod agent;
mod commands;
mod config;
mod db;
mod chats;
mod terminal;
mod tools;
pub mod vector_search;
mod walker;
mod llm;

use std::sync::Mutex;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::collections::HashMap;
use std::path::Path;
use notify::{Config as NotifyConfig, Event, RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

pub struct AppState {
    pub projects: Mutex<db::ProjectStore>,
    pub chat_store: Mutex<Option<chats::ChatStore>>,
    pub terminals: Mutex<terminal::TerminalManager>,
    pub config: Mutex<Option<config::Config>>,
    pub active_chat_id: Mutex<Option<String>>,
    pub app_handle: Mutex<Option<AppHandle>>,
    pub llm_cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub agent: Mutex<Option<agent::Agent>>,
    pub pending_confirms: Mutex<HashMap<String, oneshot::Sender<String>>>,
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
            *terminals = terminal::TerminalManager::new(cwd);
        }

        // Update chat store
        if let Ok(projects) = self.projects.lock() {
            let db_path = projects.chats_db(project_id);
            if let Ok(new_store) = chats::ChatStore::new(&db_path) {
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
                "node_modules", ".git", "dist", "build", ".next", "out",
                ".cache", ".turbo", "coverage", ".vite", "target",
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
                            ignored.iter().any(|i| p_str.contains(&format!("\\{}\\", i)) || p_str.contains(&format!("/{}/", i)))
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
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(move |app| {
            // Initialize project store
            let data_dir = dirs::data_dir()
                .unwrap_or_else(|| std::path::PathBuf::from("."))
                .join("openvibe");
            let data_dir_str = data_dir.to_string_lossy().to_string();

            let project_store = db::ProjectStore::new(&data_dir_str)
                .expect("Failed to initialize project store");

            // Get initial project
            let (initial_cwd, initial_project_id) = {
                let active = project_store.get_active();
                match active {
                    Some(ref p) if Path::new(&p.path).exists() => (p.path.clone(), Some(p.id.clone())),
                    _ => (String::new(), None),
                }
            };

            // Load config from project root
            let mut cfg = config::load_config(&initial_cwd);

            // Setup config with initial cwd
            cfg.cwd = initial_cwd.clone();

            // If config has no api_key, try loading from a provider in DB
            if cfg.api_key.is_empty() {
                let providers = project_store.list_providers();
                // Prefer matching by provider_id, otherwise take the most recently added
                let active_provider = cfg.provider_id.as_ref()
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
            let chat_store = initial_project_id.as_ref().map(|pid| {
                let db_path = project_store.chats_db(pid);
                chats::ChatStore::new(&db_path).ok()
            }).flatten();

            // Setup terminal manager
            let term_mgr = terminal::TerminalManager::new(&initial_cwd);

            let app_handle = app.handle().clone();

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
                pending_confirms: Mutex::new(HashMap::new()),
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
            commands::agent::agent_confirm,
            commands::agent::agent_set_messages,
            commands::agent::agent_get_messages,
            commands::agent::agent_revert_to,
            commands::agent::agent_set_cwd,
            commands::agent::agent_set_provider,
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
            commands::fs::fs_project_info,
            commands::fs::whisper_transcribe,
            // Project commands
            commands::projects::projects_list,
            commands::projects::projects_active,
            commands::projects::projects_add,
            commands::projects::projects_set_active,
            commands::projects::projects_remove,
            commands::projects::projects_rename,
            commands::projects::projects_close,
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
            // Tool commands
            commands::tools::tools_definitions,
            commands::tools::tools_execute,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
