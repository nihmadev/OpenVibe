#[derive(Debug, Clone)]
pub struct AgentConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub cwd: String,
    pub api_url: Option<String>,
    pub provider_id: Option<String>,
}

impl AgentConfig {
    pub fn llm_config(&self) -> LlmConfig {
        LlmConfig {
            api_key: self.api_key.clone(),
            base_url: self.base_url.clone(),
            model: self.model.clone(),
            api_url: self.api_url.clone(),
            provider_id: self.provider_id.clone(),
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub api_url: Option<String>,
    pub provider_id: Option<String>,
}
