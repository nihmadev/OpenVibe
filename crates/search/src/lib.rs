pub mod cache;
pub mod commands;
pub mod syntax;
pub mod text_search;
pub mod types;

pub mod config {
    pub use workspace_fs::{should_skip, MAX_FILE_BYTES, MAX_OUTPUT_CHARS, SKIP_DIRS};
}
pub mod gitignore_filter {
    pub use workspace_fs::{is_ignored, load_gitignore as load};
}
pub mod utils {
    pub use workspace_fs::{clip, compile_patterns, glob_to_regex, matches_any, resolve_path};
}
pub mod walker {
    pub use workspace_fs::{find_all, find_files};
}

pub use cache::{
    clear_search_cache, ensure_cached, file_groups_from_cache, file_matches_from_cache,
    filter_cached,
};
pub use syntax::{highlight_line, highlight_lines, tokenize_line};
pub use text_search::{search_content, search_content_structured};
pub use types::{ContentMatch, FileGroupEntry, FileResult, FsEntry, SearchResult, SyntaxToken};
pub use workspace_fs::{clip, compile_patterns, glob_to_regex, matches_any};
pub use workspace_fs::{find_all, find_files, is_ignored, load_gitignore, FileMatch};
