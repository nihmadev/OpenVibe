mod gitignore;
mod path;
mod policy;
mod text;
mod walker;

pub use gitignore::{is_ignored, load as load_gitignore};
pub use path::{clip, compile_patterns, glob_to_regex, matches_any, relative_path, resolve_path};
pub use policy::{should_skip, MAX_FILE_BYTES, MAX_OUTPUT_CHARS, SKIP_DIRS};
pub use text::{scan_text, walk_files, TextMatch, TextScan};
pub use walker::{find_all, find_files, FileMatch};
