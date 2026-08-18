#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmConfig {
    pub api_key: String,
    pub base_url: String,
    pub model: String,
    pub api_url: Option<String>,
    pub provider_id: Option<String>,
    pub reasoning_effort: Option<String>,
    pub prompt_cache_key: Option<String>,
}
