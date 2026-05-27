use tauri::{Emitter, State};
use crate::llm;
use crate::AppState;
use crate::chats::{ChatRecord, ChatSummary};

#[tauri::command]
pub fn chats_list(state: State<AppState>) -> Result<Vec<ChatSummary>, String> {
    let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
    match chat.as_ref() {
        Some(store) => Ok(store.list()),
        None => Ok(Vec::new()),
    }
}

#[tauri::command]
pub fn chats_list_for_project(state: State<AppState>, project_id: String) -> Result<Vec<ChatSummary>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    let db_path = store.chats_db(&project_id);
    drop(store);
    let chat_store = crate::chats::ChatStore::new(&db_path).map_err(|e| e.to_string())?;
    let result = chat_store.list();
    Ok(result)
}

#[tauri::command]
pub fn chats_new(state: State<AppState>) -> Result<Option<serde_json::Value>, String> {
    let mut active = state.active_chat_id.lock().map_err(|e| e.to_string())?;

    // Check if current chat is already empty
    if let Some(ref current_id) = *active {
        let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
        if let Some(ref store) = *chat {
            if let Some(record) = store.get(current_id) {
                if record.messages.is_empty() {
                    return Ok(Some(serde_json::json!({
                        "id": record.id,
                        "title": record.title,
                        "createdAt": record.created_at,
                        "updatedAt": record.updated_at,
                        "messageCount": 0,
                    })));
                }
            }
        }
        drop(chat);
    }

    // Persist current chat if it has messages
    if active.is_some() {
        let _ = state.persist_active_chat();
    }

    // Create new chat
    let id = format!("c{:x}-{}", chrono_now(), rand_suffix());
    let now = chrono_now();
    let record = ChatRecord {
        id: id.clone(),
        title: "New chat".to_string(),
        created_at: now,
        updated_at: now,
        messages: vec![],
    };

    {
        let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
        if let Some(ref store) = *chat {
            store.save(&record);
        }
    }

    *active = Some(id.clone());

    // Emit chats:updated event
    let app = state.app_handle.lock().map_err(|e| e.to_string())?;
    if let Some(ref handle) = *app {
        let _ = handle.emit("vibe:chats:updated", ());
    }

    Ok(Some(serde_json::json!({
        "id": id,
        "title": "New chat",
        "createdAt": now,
        "updatedAt": now,
        "messageCount": 0,
    })))
}

#[tauri::command]
pub fn chats_open(state: State<AppState>, id: String) -> Result<Option<ChatRecord>, String> {
    let mut active = state.active_chat_id.lock().map_err(|e| e.to_string())?;

    // Persist current chat silently if switching
    if let Some(ref current_id) = *active {
        if current_id != &id {
            let _ = state.persist_active_chat();
        }
    }

    let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
    let record = match chat.as_ref() {
        Some(store) => store.get(&id),
        None => return Ok(None),
    };
    *active = Some(id);
    Ok(record)
}

#[tauri::command]
pub fn chats_delete(state: State<AppState>, id: String) -> Result<(), String> {
    {
        let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
        if let Some(ref store) = *chat {
            store.delete(&id);
        }
    }
    let mut active = state.active_chat_id.lock().map_err(|e| e.to_string())?;
    if active.as_deref() == Some(&id) {
        *active = None;
    }
    let app = state.app_handle.lock().map_err(|e| e.to_string())?;
    if let Some(ref handle) = *app {
        let _ = handle.emit("vibe:chats:updated", ());
    }
    Ok(())
}

#[tauri::command]
pub fn chats_clear(state: State<AppState>, id: String) -> Result<(), String> {
    let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
    if let Some(ref store) = *chat {
        if let Some(mut record) = store.get(&id) {
            record.messages = vec![];
            record.updated_at = chrono_now();
            store.save(&record);
        }
    }
    let app = state.app_handle.lock().map_err(|e| e.to_string())?;
    if let Some(ref handle) = *app {
        let _ = handle.emit("vibe:chats:updated", ());
    }
    Ok(())
}

#[tauri::command]
pub fn chats_rename(state: State<AppState>, id: String, title: String) -> Result<(), String> {
    let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
    if let Some(ref store) = *chat {
        if let Some(mut record) = store.get(&id) {
            record.title = title;
            record.updated_at = chrono_now();
            store.save(&record);
        }
    }
    let app = state.app_handle.lock().map_err(|e| e.to_string())?;
    if let Some(ref handle) = *app {
        let _ = handle.emit("vibe:chats:updated", ());
    }
    Ok(())
}

#[tauri::command]
pub fn chats_save(state: State<AppState>, id: String, messages: Vec<llm::ChatMessage>) -> Result<(), String> {
    let chat = state.chat_store.lock().map_err(|e| e.to_string())?;
    if let Some(ref store) = *chat {
        // Prevent accidental overwrite with empty messages on restart
        if messages.is_empty() {
            if let Some(existing) = store.get(&id) {
                if !existing.messages.is_empty() {
                    return Ok(());
                }
            }
        }
        if let Some(mut record) = store.get(&id) {
            record.messages = messages;
            record.updated_at = chrono_now();
            store.save(&record);
        }
    }
    Ok(())
}

fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn rand_suffix() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().subsec_nanos();
    format!("{:05x}", nanos % 0xFFFFF)
}
