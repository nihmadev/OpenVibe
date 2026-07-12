pub mod commands;
pub mod config;
pub mod content_search;
pub mod types;
pub mod vector_search;
pub mod walker;

pub use content_search::{search_content, search_content_with_vector};
pub use types::{FileMatch, FsEntry, SearchResult};
pub use vector_search::{
    build_index, clear_all_caches, clear_cache, cosine_similarity, embed_texts, ensure_model,
    search_codebase_vector,
};
pub use walker::{find_all, find_files};
