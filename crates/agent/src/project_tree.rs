use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use std::time::{Duration, Instant};

/// Maximum depth of directory nesting to include in the tree.
/// Deeper levels are collapsed into a `...` marker.
const MAX_DEPTH: usize = 4;

/// Maximum number of entries (files + dirs) per directory level.
/// Excess entries are collapsed into a `... (N more)` marker.
const MAX_ENTRIES_PER_DIR: usize = 20;

/// Maximum total size of the generated tree string in bytes.
/// Keeps the system prompt lean — a tree should be a quick orientation aid,
/// not a file listing dump.
const MAX_TREE_BYTES: usize = 3 * 1024; // 3 KB

/// Cache TTL — the project tree is regenerated at most once per this interval.
/// File system changes between refreshes are acceptable: the tree is a hint,
/// not a source of truth.
const CACHE_TTL: Duration = Duration::from_secs(30);

/// Directories that are never useful to the agent and always skipped.
/// Mirrors the skip list in `crates/search/src/config.rs` but kept local
/// to avoid a cross-crate dependency for a simple constant.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "out",
    ".cache",
    ".turbo",
    "coverage",
    ".vite",
    "target",
    ".vscode",
    "monaco",
    "monaco-editor",
    "vendor",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "venv",
    ".venv",
    "env",
    ".env",
];

struct CacheEntry {
    tree: String,
    generated_at: Instant,
}

static TREE_CACHE: Mutex<Option<(String, CacheEntry)>> = Mutex::new(None);

/// Generate a compact, human-readable project tree suitable for embedding
/// in the agent system prompt. The tree shows directory structure and
/// top-level files, giving the agent immediate spatial awareness of the
/// project layout without needing multiple `list_dir` calls.
///
/// The result is cached per `cwd` for `CACHE_TTL` to avoid regenerating
/// on every prompt rebuild (e.g. when todo context changes).
pub fn generate_project_tree(cwd: &str) -> String {
    // Check cache first
    {
        let cache = TREE_CACHE.lock().unwrap();
        if let Some((ref cached_cwd, ref entry)) = *cache {
            if cached_cwd == cwd && entry.generated_at.elapsed() < CACHE_TTL {
                return entry.tree.clone();
            }
        }
    }

    let root = Path::new(cwd);
    let mut lines = Vec::new();
    let root_name = root
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());
    lines.push(format!("{}/", root_name));

    let mut total_bytes = lines[0].len() + 1; // +1 for newline
    build_tree(root, "", 0, &mut lines, &mut total_bytes);

    let tree = lines.join("\n");

    // Update cache
    {
        let mut cache = TREE_CACHE.lock().unwrap();
        *cache = Some((
            cwd.to_string(),
            CacheEntry {
                tree: tree.clone(),
                generated_at: Instant::now(),
            },
        ));
    }

    tree
}

fn build_tree(
    dir: &Path,
    prefix: &str,
    depth: usize,
    lines: &mut Vec<String>,
    total_bytes: &mut usize,
) {
    if depth >= MAX_DEPTH || *total_bytes >= MAX_TREE_BYTES {
        return;
    }

    let entries = match read_sorted_entries(dir) {
        Some(e) => e,
        None => return,
    };

    let (dirs, files): (Vec<_>, Vec<_>) = entries.into_iter().partition(|(_, is_dir)| *is_dir);

    // Show directories first, then files — matches how developers think about project layout
    let mut shown = 0;
    let total_entries = dirs.len() + files.len();

    for (i, (name, _)) in dirs.iter().enumerate() {
        if shown >= MAX_ENTRIES_PER_DIR || *total_bytes >= MAX_TREE_BYTES {
            let remaining = total_entries - shown;
            if remaining > 0 {
                let marker = format!("{}└── ... ({} more)", prefix, remaining);
                *total_bytes += marker.len() + 1;
                lines.push(marker);
            }
            return;
        }

        let is_last_dir = i == dirs.len() - 1;
        let has_files = !files.is_empty();
        let is_last = is_last_dir && !has_files;

        let connector = if is_last { "└── " } else { "├── " };
        let line = format!("{}{}{}/", prefix, connector, name);
        *total_bytes += line.len() + 1;
        lines.push(line);

        let child_prefix = if is_last {
            format!("{}    ", prefix)
        } else {
            format!("{}│   ", prefix)
        };

        build_tree(
            &dir.join(name),
            &child_prefix,
            depth + 1,
            lines,
            total_bytes,
        );
        shown += 1;
    }

    for (i, (name, _)) in files.iter().enumerate() {
        if shown >= MAX_ENTRIES_PER_DIR || *total_bytes >= MAX_TREE_BYTES {
            let remaining = total_entries - shown;
            if remaining > 0 {
                let marker = format!("{}└── ... ({} more)", prefix, remaining);
                *total_bytes += marker.len() + 1;
                lines.push(marker);
            }
            return;
        }

        let is_last = i == files.len() - 1;
        let connector = if is_last { "└── " } else { "├── " };
        let line = format!("{}{}{}", prefix, connector, name);
        *total_bytes += line.len() + 1;
        lines.push(line);
        shown += 1;
    }
}

/// Read directory entries, filter out noise, and return sorted (dirs first).
fn read_sorted_entries(dir: &Path) -> Option<Vec<(String, bool)>> {
    let read_dir = fs::read_dir(dir).ok()?;
    let skip_set: HashSet<&str> = SKIP_DIRS.iter().copied().collect();

    let mut entries: Vec<(String, bool)> = Vec::new();
    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs (except .env, .gitignore which are useful context)
        if name.starts_with('.') && name != ".env" && name != ".gitignore" {
            continue;
        }

        // Skip known noise directories
        if skip_set.contains(name.as_str()) {
            continue;
        }

        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        entries.push((name, is_dir));
    }

    // Sort: directories first, then alphabetical (case-insensitive)
    entries.sort_by(|a, b| {
        if a.1 != b.1 {
            return if a.1 {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        a.0.to_lowercase().cmp(&b.0.to_lowercase())
    });

    Some(entries)
}

/// Invalidate the cached tree for a given cwd (or all if None).
/// Called when the agent changes working directory or resets.
pub fn invalidate_cache(cwd: Option<&str>) {
    let mut cache = TREE_CACHE.lock().unwrap();
    match cwd {
        Some(c) => {
            if let Some((ref cached_cwd, _)) = *cache {
                if cached_cwd == c {
                    *cache = None;
                }
            }
        }
        None => *cache = None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_basic_tree() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        fs::create_dir_all(root.join("src/components")).unwrap();
        fs::create_dir_all(root.join("src/utils")).unwrap();
        fs::create_dir_all(root.join("tests")).unwrap();
        fs::write(root.join("src/main.rs"), "fn main() {}").unwrap();
        fs::write(root.join("src/lib.rs"), "").unwrap();
        fs::write(root.join("Cargo.toml"), "[package]").unwrap();
        fs::write(root.join("README.md"), "# Test").unwrap();

        let tree = generate_project_tree(root.to_str().unwrap());

        assert!(tree.contains("src/"));
        assert!(tree.contains("components/"));
        assert!(tree.contains("utils/"));
        assert!(tree.contains("tests/"));
        assert!(tree.contains("main.rs"));
        assert!(tree.contains("Cargo.toml"));
        assert!(tree.contains("README.md"));
    }

    #[test]
    fn test_skips_noise_dirs() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        fs::create_dir_all(root.join("node_modules/some-package")).unwrap();
        fs::create_dir_all(root.join(".git/objects")).unwrap();
        fs::create_dir_all(root.join("target/debug")).unwrap();
        fs::create_dir_all(root.join("src")).unwrap();
        fs::write(root.join("src/main.rs"), "").unwrap();

        let tree = generate_project_tree(root.to_str().unwrap());

        assert!(tree.contains("src/"));
        assert!(!tree.contains("node_modules"));
        assert!(!tree.contains(".git"));
        assert!(!tree.contains("target"));
    }

    #[test]
    fn test_respects_max_depth() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create nesting deeper than MAX_DEPTH
        let mut path = root.to_path_buf();
        for i in 0..8 {
            path = path.join(format!("level{}", i));
        }
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("deep_file.rs"), "").unwrap();

        let tree = generate_project_tree(root.to_str().unwrap());

        // Should contain levels up to MAX_DEPTH but not deeper
        assert!(tree.contains("level0/"));
        assert!(tree.contains("level1/"));
        assert!(tree.contains("level2/"));
        assert!(tree.contains("level3/"));
        // level4 is at MAX_DEPTH so it shows as a dir but doesn't recurse
        // deep_file.rs should NOT appear (too deep)
        assert!(!tree.contains("deep_file.rs"));
    }

    #[test]
    fn test_cache_returns_same_result() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src")).unwrap();

        let cwd = root.to_str().unwrap();
        invalidate_cache(Some(cwd));

        let tree1 = generate_project_tree(cwd);
        let tree2 = generate_project_tree(cwd);
        assert_eq!(tree1, tree2);
    }

    #[test]
    fn test_invalidate_cache() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("src")).unwrap();

        let cwd = root.to_str().unwrap();

        // Ensure a clean cache state for this cwd
        invalidate_cache(Some(cwd));
        let tree1 = generate_project_tree(cwd);

        // Add a new directory
        fs::create_dir_all(root.join("new_dir")).unwrap();

        // Without invalidation, should return cached version (no new_dir)
        let tree2 = generate_project_tree(cwd);
        assert_eq!(tree1, tree2);
        assert!(!tree2.contains("new_dir/"));

        // After invalidation, should include new dir
        invalidate_cache(Some(cwd));
        let tree3 = generate_project_tree(cwd);
        assert!(tree3.contains("new_dir/"));
    }

    #[test]
    fn test_empty_dir() {
        let dir = tempdir().unwrap();
        let tree = generate_project_tree(dir.path().to_str().unwrap());
        // Should just have the root name, no children
        assert!(tree.lines().count() <= 2);
    }

    #[test]
    fn test_max_entries_per_dir() {
        let dir = tempdir().unwrap();
        let root = dir.path();

        // Create more entries than MAX_ENTRIES_PER_DIR
        for i in 0..30 {
            fs::write(root.join(format!("file_{:02}.txt", i)), "").unwrap();
        }

        let tree = generate_project_tree(root.to_str().unwrap());
        assert!(tree.contains("... ("));
        assert!(tree.contains("more)"));
    }
}
