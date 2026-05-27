use tauri::State;
use crate::AppState;

const PROVIDER_TEMPLATE_IDS: &[&str] = &[
    "anthropic", "openai", "google", "deepseek", "groq",
    "openrouter", "ollama", "cerebras", "moonshot", "zai", "opencode", "github",
];

fn parse_model_name(model_id: &str) -> String {
    let mut name = model_id.to_string();
    if let Some(idx) = name.find('/') {
        name = name[idx + 1..].to_string();
    }
    if !name.is_empty() {
        let mut chars = name.chars();
        match chars.next() {
            Some(c) => c.to_uppercase().collect::<String>() + chars.as_str(),
            None => name,
        }
    } else {
        name
    }
}

#[tauri::command]
pub async fn models_fetch(
    state: State<'_, AppState>,
    base_url: String,
    api_key: String,
    provider_id: Option<String>,
) -> Result<serde_json::Value, String> {
    let api_url: Option<String> = {
        let config = state.config.lock().map_err(|e| e.to_string())?;
        config.as_ref().and_then(|c| c.api_url.clone())
    };

    let is_github = base_url.contains("models.github.ai");

    // Try proxy first (skip for GitHub — uses non-standard paths), fall back to direct
    if !is_github {
        if let Some(ref api_url_val) = api_url {
            if let Some(ref pid) = provider_id {
                if PROVIDER_TEMPLATE_IDS.contains(&pid.as_str()) {
                    let url = format!("{}/v2/{}/models", api_url_val.trim_end_matches('/'), pid);
                    let mut headers = Vec::new();
                    headers.push(("x-provider-base-url".to_string(), base_url.clone()));
                    if !api_key.is_empty() {
                        headers.push(("x-api-key".to_string(), api_key.clone()));
                    }
                    if let Ok(result) = do_fetch(&url, &headers).await {
                        return Ok(result);
                    }
                }
            }
        }
    }

    let url = if is_github {
        format!("{}/catalog/models", base_url.trim_end_matches('/'))
    } else {
        format!("{}/models", base_url.trim_end_matches('/'))
    };
    let mut headers = Vec::new();
    if !api_key.is_empty() {
        headers.push(("Authorization".to_string(), format!("Bearer {}", api_key)));
    }
    if is_github {
        headers.push(("Accept".to_string(), "application/vnd.github+json".to_string()));
        headers.push(("X-GitHub-Api-Version".to_string(), "2026-03-10".to_string()));
    }
    do_fetch(&url, &headers).await
}

async fn do_fetch(url: &str, headers: &[(String, String)]) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let mut req = client.get(url).timeout(std::time::Duration::from_secs(15));
    for (k, v) in headers {
        req = req.header(k, v);
    }
    let res = req.send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }
    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    // Handle {models: [...]}, {data: [...]}, and plain array formats
    let models = if let Some(models) = data.get("models").and_then(|v| v.as_array()) {
        models.clone()
    } else if let Some(data_arr) = data.get("data").and_then(|v| v.as_array()) {
        data_arr.clone()
    } else if let Some(arr) = data.as_array() {
        arr.clone()
    } else {
        return Err("Unexpected response format".to_string());
    };

    let mapped: Vec<serde_json::Value> = models
        .iter()
        .map(|m| {
            let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let name = match m.get("name").and_then(|v| v.as_str()) {
                Some(n) => n.to_string(),
                None => parse_model_name(&id),
            };
            serde_json::json!({ "id": id, "name": name })
        })
        .collect();

    Ok(serde_json::json!({ "ok": true, "models": mapped }))
}

#[tauri::command]
pub fn models_list_disabled(state: State<AppState>) -> Result<Vec<String>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.list_disabled_models())
}

#[tauri::command]
pub fn models_toggle_disabled(state: State<AppState>, model_id: String) -> Result<bool, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.toggle_disabled_model(&model_id))
}

#[tauri::command]
pub fn models_list_enabled(state: State<AppState>) -> Result<Vec<String>, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.list_enabled_models())
}

#[tauri::command]
pub fn models_toggle_enabled(state: State<AppState>, model_id: String) -> Result<bool, String> {
    let store = state.projects.lock().map_err(|e| e.to_string())?;
    Ok(store.toggle_enabled_model(&model_id))
}
