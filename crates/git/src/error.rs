use std::fmt;

#[derive(Debug)]
pub enum GitError {
    NotFound(String),
    Git2(git2::Error),
    Other(String),
}

impl fmt::Display for GitError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            GitError::NotFound(msg) => write!(f, "{}", msg),
            GitError::Git2(e) => write!(f, "{}", e),
            GitError::Other(msg) => write!(f, "{}", msg),
        }
    }
}

impl From<git2::Error> for GitError {
    fn from(e: git2::Error) -> Self {
        GitError::Git2(e)
    }
}

impl From<String> for GitError {
    fn from(msg: String) -> Self {
        GitError::Other(msg)
    }
}

impl From<std::io::Error> for GitError {
    fn from(e: std::io::Error) -> Self {
        GitError::Other(e.to_string())
    }
}

pub type Result<T> = std::result::Result<T, GitError>;
