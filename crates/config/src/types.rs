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
}

impl Config {
    pub fn to_agent_config(&self) -> agent::config::AgentConfig {
        agent::config::AgentConfig {
            api_key: self.api_key.clone(),
            base_url: self.base_url.clone(),
            model: self.model.clone(),
            cwd: self.cwd.clone(),
            api_url: self.api_url.clone(),
            provider_id: self.provider_id.clone(),
        }
    }
}
