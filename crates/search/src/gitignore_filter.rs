use std::path::Path;

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use ignore::Match;

/// Load .gitignore for a given root directory.
/// Returns `None` if no `.gitignore` exists or it cannot be parsed.
pub fn load(root: &Path) -> Option<Gitignore> {
    let gi_path = root.join(".gitignore");
    if !gi_path.exists() {
        return None;
    }
    let content = std::fs::read_to_string(gi_path.as_path()).ok()?;
    let mut builder = GitignoreBuilder::new(root);
    for line in content.lines() {
        let _ = builder.add_line(Some(gi_path.clone()), line);
    }
    builder.build().ok()
}

/// Check whether a relative path is ignored by the given gitignore rules.
pub fn is_ignored(gi: &Gitignore, rel_path: &Path, is_dir: bool) -> bool {
    matches!(gi.matched(rel_path, is_dir), Match::Ignore(_))
}
