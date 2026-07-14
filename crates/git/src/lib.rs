pub mod commit;
pub mod diff;
pub mod error;
pub mod repository;
pub mod status;

pub use commit::*;
pub use diff::*;
pub use error::{GitError, Result};
pub use repository::*;
pub use status::*;

pub fn is_repository(path: &str) -> bool {
    git2::Repository::discover(path).is_ok()
}

pub fn discover(path: &str) -> Result<git2::Repository> {
    git2::Repository::discover(path).map_err(|e| {
        if e.class() == git2::ErrorClass::Repository {
            crate::error::GitError::NotFound(format!("Not a git repository: {}", path))
        } else {
            crate::error::GitError::Git2(e)
        }
    })
}
