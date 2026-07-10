use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

use tokio::process::Command;
use tokio::time::timeout;

pub async fn tool_bash(
    cwd: &str,
    args: &serde_json::Value,
    cancel: &AtomicBool,
) -> Result<String, String> {
    let command = args
        .get("command")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'command' argument".to_string())?;
    let timeout_ms = args
        .get("timeout")
        .and_then(|v| v.as_u64())
        .unwrap_or(60_000);

    let resolved_cwd = if Path::new(cwd).is_absolute() {
        cwd.to_string()
    } else {
        std::env::current_dir()
            .map(|p| p.join(cwd).to_string_lossy().to_string())
            .unwrap_or_else(|_| cwd.to_string())
    };

    let shell = if cfg!(target_os = "windows") {
        "cmd.exe"
    } else {
        "sh"
    };
    let flag = if cfg!(target_os = "windows") {
        "/C"
    } else {
        "-c"
    };

    let child = Command::new(shell)
        .arg(flag)
        .arg(command)
        .current_dir(&resolved_cwd)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to spawn: {e}"))?;

    let result = timeout(Duration::from_millis(timeout_ms), child.wait_with_output())
        .await
        .map_err(|_| format!("[killed after {timeout_ms}ms]"))?;

    let output = result.map_err(|e| format!("Process error: {e}"))?;

    if cancel.load(Ordering::Relaxed) {
        return Err("Aborted".to_string());
    }

    let mut out = String::new();
    if !output.stdout.is_empty() {
        out.push_str(&String::from_utf8_lossy(&output.stdout));
    }
    if !output.stderr.is_empty() {
        if !out.is_empty() {
            out.push('\n');
        }
        out.push_str(&String::from_utf8_lossy(&output.stderr));
    }

    let exit_code = output.status.code().unwrap_or(-1);
    if !output.status.success() {
        out.push_str(&format!("\n[exit code: {exit_code}]"));
    }

    Ok(clip(&out, 16_000))
}

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        format!("{}\n…[truncated, {} more chars]", &text[..max], text.len() - max)
    }
}
