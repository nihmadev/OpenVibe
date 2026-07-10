use std::path::Path;

pub async fn tool_write_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let content = args
        .get("content")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'content' argument".to_string())?;

    let resolved = if Path::new(path).is_absolute() {
        path.to_string()
    } else {
        Path::new(cwd).join(path).to_string_lossy().to_string()
    };

    if let Some(parent) = Path::new(&resolved).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    tokio::fs::write(&resolved, content)
        .await
        .map_err(|e| format!("Failed to write file: {e}"))?;

    let display = Path::new(&resolved)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| resolved.clone());

    Ok(format!("Created {display}"))
}
