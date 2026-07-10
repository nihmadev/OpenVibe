use std::path::Path;

pub async fn tool_list_dir(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .unwrap_or(".");

    let resolved = if Path::new(path).is_absolute() {
        path.to_string()
    } else {
        Path::new(cwd).join(path).to_string_lossy().to_string()
    };

    let mut entries = tokio::fs::read_dir(&resolved)
        .await
        .map_err(|e| format!("Failed to list directory: {e}"))?;

    let mut names: Vec<String> = Vec::new();
    while let Some(entry) = entries
        .next_entry()
        .await
        .map_err(|e| format!("Failed to read entry: {e}"))?
    {
        let name = entry.file_name().to_string_lossy().to_string();
        if entry
            .file_type()
            .await
            .map(|t| t.is_dir())
            .unwrap_or(false)
        {
            names.push(format!("{name}/"));
        } else {
            names.push(name);
        }
    }

    names.sort_by(|a, b| {
        let a_dir = a.ends_with('/');
        let b_dir = b.ends_with('/');
        if a_dir != b_dir {
            return if a_dir { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }
        a.to_lowercase().cmp(&b.to_lowercase())
    });

    if names.is_empty() {
        Ok("(empty)".to_string())
    } else {
        Ok(names.join("\n"))
    }
}
