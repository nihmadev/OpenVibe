use std::path::Path;

const MAX_FILE_BYTES: u64 = 256 * 1024;
const MAX_OUTPUT_CHARS: usize = 16_000;

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        format!(
            "{}\n…[truncated, {} more chars]",
            &text[..max],
            text.len() - max
        )
    }
}

fn resolve_path(cwd: &str, p: &str) -> String {
    let path = Path::new(p);
    if path.is_absolute() {
        p.to_string()
    } else {
        Path::new(cwd).join(p).to_string_lossy().to_string()
    }
}

pub async fn tool_read_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let resolved = resolve_path(cwd, path);

    let mut file = tokio::fs::File::open(&resolved)
        .await
        .map_err(|e| format!("Failed to open file: {e}"))?;

    let metadata = file
        .metadata()
        .await
        .map_err(|e| format!("Failed to read metadata: {e}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!("File too large ({} bytes)", metadata.len()));
    }

    let mut content = String::new();
    tokio::io::AsyncReadExt::read_to_string(&mut file, &mut content)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;

    Ok(clip(&content, MAX_OUTPUT_CHARS))
}
