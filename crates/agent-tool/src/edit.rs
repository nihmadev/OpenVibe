use std::path::Path;

pub async fn tool_edit_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let old_str = args
        .get("old_str")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'old_str' argument".to_string())?;
    let new_str = args
        .get("new_str")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'new_str' argument".to_string())?;

    let resolved = if Path::new(path).is_absolute() {
        path.to_string()
    } else {
        Path::new(cwd).join(path).to_string_lossy().to_string()
    };

    let content = tokio::fs::read_to_string(&resolved)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;

    if !content.contains(old_str) {
        return Err(format!(
            "Could not find exact match for old_str in {path}"
        ));
    }

    let first = content.find(old_str).unwrap();
    let rest = &content[first + old_str.len()..];
    if rest.contains(old_str) {
        return Err(format!(
            "old_str is not unique in {path}; provide more surrounding context."
        ));
    }

    let new_content = content.replacen(old_str, new_str, 1);
    tokio::fs::write(&resolved, &new_content)
        .await
        .map_err(|e| format!("Failed to write file: {e}"))?;

    let display = Path::new(&resolved)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| resolved.clone());

    Ok(format!("Updated {display}"))
}
