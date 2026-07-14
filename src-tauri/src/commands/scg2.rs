use crate::AppState;
use scg2::EditorEventBatch;
use tauri::State;

#[tauri::command]
pub async fn scg2_push_events(
    state: State<'_, AppState>,
    batch: EditorEventBatch,
) -> Result<(), String> {
    state.scg2_engine.push_batch(batch);
    Ok(())
}
