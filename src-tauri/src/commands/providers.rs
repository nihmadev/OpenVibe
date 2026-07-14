use crate::AppState;
use db::Provider;
use tauri::State;

#[tauri::command]
pub fn providers_list(state: State<AppState>) -> Result<Vec<Provider>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.list_providers().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn providers_save(state: State<AppState>, provider: Provider) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.save_provider(&provider).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn providers_delete(state: State<AppState>, id: String) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.delete_provider(&id).map_err(|e| e.to_string())?;
    Ok(())
}
