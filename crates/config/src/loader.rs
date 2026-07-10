use std::collections::HashMap;
use std::path::PathBuf;

use crate::types::Config;
use crate::{dotenv, provider};

pub fn load_config(cwd: &str) -> Config {
    let mut env = HashMap::new();

    let cwd_env = PathBuf::from(cwd).join(".env");
    dotenv::load_dotenv(&cwd_env, &mut env);

    if let Some(home) = dirs::home_dir() {
        let vibe_config = home.join(".vibe").join("config");
        dotenv::load_dotenv(&vibe_config, &mut env);
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
    let moonshot_key = get("MOONSHOT_API_KEY");
    let zai_key = get("ZAI_API_KEY");

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

    if api_key.is_empty() && !moonshot_key.is_empty() {
        api_key = moonshot_key;
        if base_url.is_empty() {
            base_url = "https://api.moonshot.cn/v1".to_string();
        }
        if model.is_empty() {
            model = "moonshot-v1-auto".to_string();
        }
        provider_id = Some("moonshot".to_string());
    }

    if api_key.is_empty() && !zai_key.is_empty() {
        api_key = zai_key;
        if base_url.is_empty() {
            base_url = "https://api.z.ai/api/paas/v4".to_string();
        }
        if model.is_empty() {
            model = "glm-5.1".to_string();
        }
        provider_id = Some("zai".to_string());
    }

    if base_url.is_empty() {
        base_url = "https://api.openai.com/v1".to_string();
    }
    if model.is_empty() {
        model = "gpt-4o-mini".to_string();
    }
    if provider_id.is_none() {
        provider_id = Some(provider::derive_provider_id(&base_url));
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
