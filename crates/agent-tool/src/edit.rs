use std::path::Path;

/// Build a diagnostic hint for a failed exact match so the model can
/// self-correct in one step instead of blindly re-reading and retrying:
/// find the file line closest to the first line of `old_str` and show the
/// surrounding lines from the actual file.
fn near_miss_hint(content: &str, old_str: &str) -> String {
    let probe = match old_str.lines().map(str::trim).find(|l| !l.is_empty()) {
        Some(l) => l,
        None => return String::new(),
    };

    // Prefer an exact (trimmed) line hit; fall back to a substring hit.
    let lines: Vec<&str> = content.lines().collect();
    let hit = lines
        .iter()
        .position(|l| l.trim() == probe)
        .or_else(|| lines.iter().position(|l| l.contains(probe)));

    match hit {
        Some(idx) => {
            let start = idx.saturating_sub(2);
            let end = (idx + old_str.lines().count() + 2).min(lines.len());
            let snippet = lines[start..end].join("\n");
            format!(
                " A similar region exists at line {} — actual file content \
                 (lines {}-{}):\n{}\nAdjust old_str to match this text exactly \
                 (including whitespace).",
                idx + 1,
                start + 1,
                end,
                snippet
            )
        }
        None => " No line similar to the start of old_str was found — the file may have \
             changed since it was read. Re-read the file before retrying."
            .to_string(),
    }
}

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
            "Could not find exact match for old_str in {path}.{}",
            near_miss_hint(&content, old_str)
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
