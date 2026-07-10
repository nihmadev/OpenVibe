pub mod config;
pub mod types;
pub mod vector_search;
pub mod walker;
pub mod content_search;
pub mod commands;

pub use types::{FileMatch, SearchResult, FsEntry};
pub use vector_search::{
    ensure_model, build_index, search_codebase_vector,
    embed_texts, clear_cache, clear_all_caches, cosine_similarity,
};
pub use walker::{find_files, find_all};
pub use content_search::{search_content, search_content_with_vector};