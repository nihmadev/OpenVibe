use crate::AppState;
use tauri::{Emitter, State};

#[tauri::command]
pub fn term_start(
    state: State<AppState>,
    app_handle: tauri::AppHandle,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<bool, String> {
    let manager = state.terminals.lock().map_err(|e| e.to_string())?;
    let app_clone = app_handle.clone();
    let id_clone = id.clone();
    let id_clone2 = id.clone();
    manager.start(
        &id,
        cols,
        rows,
        move |chunk| {
            let _ = app_clone.emit("vibe:term:data", serde_json::json!({ "id": &id_clone, "chunk": chunk }));
        },
        move |code| {
            let _ = app_handle.emit("vibe:term:exit", serde_json::json!({ "id": &id_clone2, "code": code }));
        },
    );
    Ok(true)
}

#[tauri::command]
pub fn term_write(state: State<AppState>, id: String, data: String) -> Result<(), String> {
    let manager = state.terminals.lock().map_err(|e| e.to_string())?;
    manager.write(&id, &data);
    Ok(())
}

#[tauri::command]
pub fn term_resize(state: State<AppState>, id: String, cols: u16, rows: u16) -> Result<(), String> {
    let manager = state.terminals.lock().map_err(|e| e.to_string())?;
    manager.resize(&id, cols, rows);
    Ok(())
}

#[tauri::command]
pub fn term_kill(state: State<AppState>, id: String) -> Result<(), String> {
    let manager = state.terminals.lock().map_err(|e| e.to_string())?;
    manager.kill(&id);
    Ok(())
}
