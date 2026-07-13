use editor::{preload_types, PreloadTypesResult};

#[tauri::command]
pub async fn editor_preload_types(cwd: String) -> Result<PreloadTypesResult, String> {
    preload_types(&cwd)
}
