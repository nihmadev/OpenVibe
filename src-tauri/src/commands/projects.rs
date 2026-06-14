use tauri::State;
use crate::AppState;
use crate::db::Project;

#[tauri::command]
pub fn projects_list(state: State<AppState>) -> Result<Vec<Project>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.list())
}

#[tauri::command]
pub fn projects_active(state: State<AppState>) -> Result<Option<Project>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.get_active())
}

#[tauri::command]
pub async fn projects_add(state: State<'_, AppState>, app_handle: tauri::AppHandle) -> Result<Option<Project>, String> {
    use tauri_plugin_dialog::DialogExt;
    let path = app_handle.dialog()
        .file()
        .blocking_pick_folder();

    let path = match path {
        Some(p) => p.to_string(),
        None => return Ok(None),
    };

    let mut store = state.projects.lock().map_err(|e| e.to_string())?;
    let project = store.add(&path);
    drop(store);
    Ok(Some(project))
}

#[tauri::command]
pub fn projects_set_active(state: State<AppState>, id: String) -> Result<Option<Project>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    let project = store.set_active(&id);
    if let Some(ref p) = project {
        let cwd = p.path.clone();
        let pid = p.id.clone();
        drop(store);
        state.switch_to_project(&cwd, &pid);
    }
    Ok(project)
}

#[tauri::command]
pub fn projects_remove(state: State<AppState>, id: String) -> Result<Option<Project>, String> {
    let mut store = state.projects.lock().map_err(|e| e.to_string())?;
    let next = store.remove(&id);
    drop(store);
    if let Some(ref p) = next {
        let cwd = p.path.clone();
        let pid = p.id.clone();
        state.switch_to_project(&cwd, &pid);
    } else {
        state.reset_project_state();
    }
    Ok(next)
}

#[tauri::command]
pub fn projects_rename(state: State<AppState>, id: String, name: String) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.rename(&id, &name);
    Ok(())
}

#[tauri::command]
pub fn projects_close(state: State<AppState>) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.clear_active();
    drop(store);
    state.reset_project_state();
    Ok(())
}

#[tauri::command]
pub fn projects_set_color(state: State<AppState>, id: String, color: String) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.set_color(&id, &color);
    Ok(())
}

#[tauri::command]
pub fn projects_set_icon(state: State<AppState>, id: String, icon: Option<String>) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.set_icon(&id, icon.as_deref());
    Ok(())
}

#[tauri::command]
pub fn projects_set_photo(state: State<AppState>, id: String, photo: Option<String>) -> Result<(), String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    store.set_photo(&id, photo.as_deref());
    Ok(())
}
