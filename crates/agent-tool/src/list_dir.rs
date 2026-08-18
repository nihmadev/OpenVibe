/// Cap on directory entries returned to the model. Uncapped listings of
/// folders like node_modules can dump tens of thousands of names into the
/// conversation, instantly blowing the context window and triggering lossy
/// history compaction.
const MAX_ENTRIES: usize = 500;

pub async fn tool_list_dir(cwd: &str, args: &serde_json::Value) -> Result<String, String> {
    let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(".");

    let resolved = workspace_fs::resolve_path(cwd, path);

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
        if workspace_fs::should_skip(&name) {
            continue;
        }
        if entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false) {
            names.push(format!("{name}/"));
        } else {
            names.push(name);
        }
    }

    names.sort_by(|a, b| {
        let a_dir = a.ends_with('/');
        let b_dir = b.ends_with('/');
        if a_dir != b_dir {
            return if a_dir {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.to_lowercase().cmp(&b.to_lowercase())
    });

    if names.is_empty() {
        Ok("(empty)".to_string())
    } else if names.len() > MAX_ENTRIES {
        let total = names.len();
        names.truncate(MAX_ENTRIES);
        let mut out = names.join("\n");
        out.push_str(&format!(
            "\n…[showing {MAX_ENTRIES} of {total} entries; directories listed first]"
        ));
        Ok(out)
    } else {
        Ok(names.join("\n"))
    }
}
