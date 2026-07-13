pub mod commands;
pub mod config;
pub mod content_search;
pub mod gitignore_filter;
pub mod types;
pub mod vector_search;
pub mod walker;

pub use content_search::{
    clear_search_cache, ensure_cached, file_groups_from_cache, file_matches_from_cache,
    filter_cached, highlight_line, highlight_lines, search_content, search_content_structured,
    search_content_with_vector, tokenize_line,
};
pub use gitignore_filter::{is_ignored, load as load_gitignore};
pub use types::{ContentMatch, FileGroupEntry, FileMatch, FileResult, FsEntry, SearchResult, SyntaxToken};
pub use vector_search::{
    build_index, clear_all_caches, clear_cache, cosine_similarity, embed_texts, ensure_model,
    search_codebase_vector,
};
pub use walker::{find_all, find_files};
