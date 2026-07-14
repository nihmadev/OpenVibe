use std::collections::HashMap;
use std::process::Command;

/// Returns a list of file paths that are frequently committed alongside the active_file.
/// The paths are relative to the repository root.
pub fn get_co_committed_files(repo_path: &str, active_file: &str, limit: usize) -> Vec<String> {
    // 1. Get recent commit hashes that touched the active_file
    let output = Command::new("git")
        .current_dir(repo_path)
        .args(["log", "-n", "20", "--format=%H", "--", active_file])
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => return Vec::new(),
    };

    if !output.status.success() {
        return Vec::new();
    }

    let hashes = String::from_utf8_lossy(&output.stdout);
    let mut file_counts: HashMap<String, usize> = HashMap::new();

    // 2. For each commit, see what other files were modified
    for hash in hashes.lines() {
        let hash = hash.trim();
        if hash.is_empty() {
            continue;
        }

        let show_output = Command::new("git")
            .current_dir(repo_path)
            .args(["show", "--name-only", "--format=", hash])
            .output();

        if let Ok(o) = show_output {
            if o.status.success() {
                let files = String::from_utf8_lossy(&o.stdout);
                for file in files.lines() {
                    let file = file.trim();
                    if !file.is_empty() && file != active_file {
                        *file_counts.entry(file.to_string()).or_insert(0) += 1;
                    }
                }
            }
        }
    }

    // 3. Sort by frequency descending
    let mut sorted: Vec<(String, usize)> = file_counts.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));

    sorted.into_iter().take(limit).map(|(f, _)| f).collect()
}
