use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

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

fn load_dotenv(path: &PathBuf, env: &mut HashMap<String, String>) {
    if !path.exists() {
        return;
    }
    let text = match fs::read_to_string(path) {
        Ok(t) => t,
        Err(_) => return,
    };
    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        if let Some(eq) = trimmed.find('=') {
            let key = trimmed[..eq].trim().to_string();
            let mut value = trimmed[eq + 1..].trim().to_string();
            if (value.starts_with('"') && value.ends_with('"'))
                || (value.starts_with('\'') && value.ends_with('\''))
            {
                value = value[1..value.len() - 1].to_string();
            }
            env.entry(key).or_insert(value);
        }
    }
}

fn derive_provider_id(base_url: &str) -> String {
    let known: &[(&str, &str)] = &[
        ("generativelanguage.googleapis.com", "google"),
        ("api.groq.com", "groq"),
        ("api.cerebras.ai", "cerebras"),
        ("api.anthropic.com", "anthropic"),
        ("api.openai.com", "openai"),
        ("api.deepseek.com", "deepseek"),
        ("openrouter.ai", "openrouter"),
        ("api.moonshot.cn", "moonshot"),
        ("api.zai.com", "zai"),
        ("opencode.ai", "opencode"),
        ("models.github.ai", "github"),
        ("localhost:11434", "ollama"),
    ];
    for (sub, id) in known {
        if base_url.contains(sub) {
            return id.to_string();
        }
    }
    "default".to_string()
}

pub fn load_config(cwd: &str) -> Config {
    let mut env = HashMap::new();

    // Load project .env and user ~/.vibe/config
    let cwd_env = PathBuf::from(cwd).join(".env");
    load_dotenv(&cwd_env, &mut env);

    if let Some(home) = dirs::home_dir() {
        let vibe_config = home.join(".vibe").join("config");
        load_dotenv(&vibe_config, &mut env);
    }

    let get = |key: &str| env.get(key).cloned().unwrap_or_default();

    let mut api_key = get("VIBE_API_KEY");
    if api_key.is_empty() {
        api_key = get("OPENAI_API_KEY");
    }
    let mut base_url = get("VIBE_BASE_URL");
    if base_url.is_empty() {
        base_url = get("OPENAI_BASE_URL");
    }
    let mut model = get("VIBE_MODEL");

    let google_key = get("GOOGLE_AI_KEY");
    let groq_key = get("GROQ_API_KEY");
    let cerebras_key = get("CEREBRAS_API_KEY");
    let github_key = get("GITHUB_TOKEN");

    let mut provider_id: Option<String> = None;

    if api_key.is_empty() && !google_key.is_empty() {
        api_key = google_key;
        if base_url.is_empty() {
            base_url = "https://generativelanguage.googleapis.com/v1beta/openai".to_string();
        }
        if model.is_empty() {
            model = "gemini-2.0-flash".to_string();
        }
        provider_id = Some("google".to_string());
    }

    if api_key.is_empty() && !groq_key.is_empty() {
        api_key = groq_key;
        if base_url.is_empty() {
            base_url = "https://api.groq.com/openai/v1".to_string();
        }
        if model.is_empty() {
            model = "llama-3.1-8b-instant".to_string();
        }
        provider_id = Some("groq".to_string());
    }

    if api_key.is_empty() && !cerebras_key.is_empty() {
        api_key = cerebras_key;
        if base_url.is_empty() {
            base_url = "https://api.cerebras.ai/v1".to_string();
        }
        if model.is_empty() {
            model = "llama3.3-70b".to_string();
        }
        provider_id = Some("cerebras".to_string());
    }

    if api_key.is_empty() && !github_key.is_empty() {
        api_key = github_key;
        if base_url.is_empty() {
            base_url = "https://models.github.ai".to_string();
        }
        if model.is_empty() {
            model = "gpt-4o-mini".to_string();
        }
        provider_id = Some("github".to_string());
    }

    if base_url.is_empty() {
        base_url = "https://api.openai.com/v1".to_string();
    }
    if model.is_empty() {
        model = "gpt-4o-mini".to_string();
    }
    if provider_id.is_none() {
        provider_id = Some(derive_provider_id(&base_url));
    }

    let api_url = get("VIBE_API_URL");
    let api_url = if api_url.is_empty() {
        Some("https://openvibe-api-production.up.railway.app".to_string())
    } else {
        Some(api_url)
    };

    Config {
        api_key,
        base_url: base_url.trim_end_matches('/').to_string(),
        model,
        cwd: cwd.to_string(),
        auto_approve: true,
        provider_id,
        api_url,
    }
}
