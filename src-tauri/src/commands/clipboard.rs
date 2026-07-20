use once_cell::sync::Lazy;
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Mutex;

static LAST_WL_COPY: Lazy<Mutex<Option<std::process::Child>>> = Lazy::new(|| Mutex::new(None));

#[tauri::command]
pub fn clipboard_write_text(text: String) -> Result<(), String> {
    // Kill previous wl-copy process if still running
    if let Ok(mut last) = LAST_WL_COPY.lock() {
        if let Some(mut child) = last.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    // Try wl-copy with --paste-once (uses data-device protocol, works on Niri)
    match Command::new("wl-copy").arg("--paste-once").stdin(Stdio::piped()).spawn() {
        Ok(mut child) => {
            if let Some(stdin) = child.stdin.take() {
                let mut stdin = stdin;
                if let Err(e) = stdin.write_all(text.as_bytes()) {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("wl-copy stdin write failed: {}", e));
                }
            }
            // Don't wait - process stays alive until paste
            if let Ok(mut last) = LAST_WL_COPY.lock() {
                *last = Some(child);
            }
            Ok(())
        }
        Err(e) => Err(format!("wl-copy not found or failed: {}", e)),
    }
}
