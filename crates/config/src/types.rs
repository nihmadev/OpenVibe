use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub cwd: String,
    pub auto_approve: bool,
    pub provider_id: Option<String>,
    pub api_url: Option<String>,
    pub reasoning_effort: Option<String>,
}
