use std::collections::HashMap;
use std::process::Command;

/// Returns a list of file paths that are frequently committed alongside the active_file.
/// The paths are relative to the repository root.
pub fn get_co_committed_files(repo_path: &str, active_file: &str, limit: usize) -> Vec<String> {
    if active_file.is_empty() {
        return Vec::new();
    }

    // Fetch co-committed files across recent commits touching `active_file` in a single git process call
    let output = Command::new("git")
        .current_dir(repo_path)
        .args([
            "log",
            "-n",
            "20",
            "--name-only",
            "--format=",
            "--",
            active_file,
        ])
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    if !output.status.success() {
        return Vec::new();
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut file_counts: HashMap<String, usize> = HashMap::new();

    for line in stdout.lines() {
        let file = line.trim();
        if !file.is_empty() && file != active_file {
            *file_counts.entry(file.to_string()).or_insert(0) += 1;
        }
    }

    // Sort by frequency descending
    let mut sorted: Vec<(String, usize)> = file_counts.into_iter().collect();
    sorted.sort_by_key(|b| std::cmp::Reverse(b.1));

    sorted.into_iter().take(limit).map(|(f, _)| f).collect()
}
