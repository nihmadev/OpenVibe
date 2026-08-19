use workspace_fs::{resolve_path, MAX_FILE_BYTES, MAX_OUTPUT_CHARS};

fn clip(text: &str, max: usize) -> String {
    if text.len() <= max {
        text.to_string()
    } else {
        let mut end = max;
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        format!(
            "{}\n…[truncated, {} more chars; re-read with 'offset' to continue]",
            &text[..end],
            text.len() - end
        )
    }
}

pub async fn tool_read_file(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args
        .get("path")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'path' argument".to_string())?;
    let offset = args
        .get("offset")
        .and_then(|v| v.as_u64())
        .map(|v| (v.max(1)) as usize);
    let limit = args
        .get("limit")
        .and_then(|v| v.as_u64())
        .map(|v| v as usize);
    let resolved = resolve_path(cwd, path);

    let mut file = tokio::fs::File::open(&resolved)
        .await
        .map_err(|e| format!("Failed to open file: {e}"))?;

    let metadata = file
        .metadata()
        .await
        .map_err(|e| format!("Failed to read metadata: {e}"))?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(format!(
            "File too large ({} bytes). Use 'offset' and 'limit' to read a slice, or search_codebase to locate the relevant lines.",
            metadata.len()
        ));
    }

    let mut content = String::new();
    tokio::io::AsyncReadExt::read_to_string(&mut file, &mut content)
        .await
        .map_err(|e| format!("Failed to read file: {e}"))?;

    // No slicing requested: return the whole (clipped) file. When clipping,
    // tell the model the exact line to continue from — a bare "use offset"
    // hint without a number forces a guess-and-retry round-trip.
    if offset.is_none() && limit.is_none() {
        if content.len() <= MAX_OUTPUT_CHARS {
            return Ok(content);
        }
        let mut end = MAX_OUTPUT_CHARS;
        while !content.is_char_boundary(end) {
            end -= 1;
        }
        let shown = &content[..end];
        let shown_lines = shown.lines().count();
        let total_lines = content.lines().count();
        // If the cut landed mid-line, that line is partial — continue from it
        // (re-reading it whole) instead of skipping its remainder.
        let next_offset = if shown.ends_with('\n') {
            shown_lines + 1
        } else {
            shown_lines.max(1)
        };
        return Ok(format!(
            "{shown}\n…[truncated] [showing lines 1-{shown_lines} of {total_lines}] \
             [use offset={next_offset} to continue]"
        ));
    }

    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();
    let start = offset.unwrap_or(1);
    if total == 0 {
        return Ok(format!("[file is empty; requested offset={start}]"));
    }
    if start > total {
        return Err(format!(
            "Offset {start} is beyond the end of file ({total} lines total)"
        ));
    }
    let count = limit.unwrap_or(total);
    let end = (start - 1).saturating_add(count).min(total);
    let slice = lines[start - 1..end].join("\n");

    let mut out = clip(&slice, MAX_OUTPUT_CHARS);
    out.push_str(&format!("\n\n[showing lines {start}-{end} of {total}]"));
    if end < total {
        out.push_str(&format!(" [use offset={} to continue]", end + 1));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn read_with(args: serde_json::Value, content: &str) -> Result<String, String> {
        let dir = tempfile::tempdir().unwrap();
        let file_path = dir.path().join("test.txt");
        std::fs::write(&file_path, content).unwrap();
        let mut full_args = args;
        full_args["path"] = serde_json::json!(file_path.to_string_lossy());
        tool_read_file(dir.path().to_str().unwrap(), &full_args).await
    }

    #[tokio::test]
    async fn reads_whole_file_without_offset() {
        let out = read_with(serde_json::json!({}), "a\nb\nc").await.unwrap();
        assert_eq!(out, "a\nb\nc");
    }

    #[tokio::test]
    async fn respects_offset_and_limit() {
        let out = read_with(
            serde_json::json!({"offset": 2, "limit": 2}),
            "l1\nl2\nl3\nl4\nl5",
        )
        .await
        .unwrap();
        assert!(out.starts_with("l2\nl3"));
        assert!(out.contains("[showing lines 2-3 of 5]"));
        assert!(out.contains("[use offset=4 to continue]"));
    }

    #[tokio::test]
    async fn respects_limit_only() {
        let out = read_with(serde_json::json!({"limit": 2}), "l1\nl2\nl3")
            .await
            .unwrap();
        assert!(out.starts_with("l1\nl2"));
        assert!(out.contains("[showing lines 1-2 of 3]"));
    }

    #[tokio::test]
    async fn offset_beyond_eof_errors() {
        let err = read_with(serde_json::json!({"offset": 10}), "l1\nl2")
            .await
            .unwrap_err();
        assert!(err.contains("beyond the end of file"));
    }

    #[test]
    fn clip_is_utf8_safe() {
        // Multi-byte characters must not cause a panic at the clip boundary.
        let text = "я".repeat(20_000);
        let clipped = clip(&text, MAX_OUTPUT_CHARS);
        assert!(clipped.contains("truncated"));
    }
}
