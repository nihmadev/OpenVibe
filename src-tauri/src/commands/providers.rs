use tauri::State;
use crate::AppState;
use db::Provider;

#[tauri::command]
pub fn providers_list(state: State<AppState>) -> Result<Vec<Provider>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.list_providers())
}

#[tauri::command]
pub fn providers_save(state: State<AppState>, provider: Provider) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.save_provider(&provider);
    Ok(())
}

#[tauri::command]
pub fn providers_delete(state: State<AppState>, id: String) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.delete_provider(&id);
    Ok(())
}
