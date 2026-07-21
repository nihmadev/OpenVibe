use std::collections::HashMap;
use std::path::PathBuf;

use crate::types::Config;
use crate::{dotenv, provider};

pub fn load_config(cwd: &str) -> Config {
    let mut env = HashMap::new();

    let cwd_env = PathBuf::from(cwd).join(".env");
    dotenv::load_dotenv(&cwd_env, &mut env);

    // Global API key fallback: %APPDATA%/OpenVibe/.env
    if let Some(data_dir) = dirs::data_dir() {
        let app_env = data_dir.join("OpenVibe").join(".env");
        dotenv::load_dotenv(&app_env, &mut env);
    }

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
    let together_key = get("TOGETHER_API_KEY");
    let fireworks_key = get("FIREWORKS_API_KEY");
    let mistral_key = get("MISTRAL_API_KEY");
    let xai_key = get("XAI_API_KEY");
    let cohere_key = get("COHERE_API_KEY");
    let perplexity_key = get("PERPLEXITY_API_KEY");
    let huggingface_key = get("HUGGINGFACE_API_KEY");
    let replicate_key = get("REPLICATE_API_KEY");
    let deepinfra_key = get("DEEPINFRA_API_KEY");
    let nvidia_key = get("NVIDIA_API_KEY");

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

    if api_key.is_empty() && !together_key.is_empty() {
        api_key = together_key;
        if base_url.is_empty() {
            base_url = "https://api.together.ai/v1".to_string();
        }
        if model.is_empty() {
            model = "mistralai/Mixtral-8x7B-Instruct-v0.1".to_string();
        }
        provider_id = Some("together".to_string());
    }

    if api_key.is_empty() && !fireworks_key.is_empty() {
        api_key = fireworks_key;
        if base_url.is_empty() {
            base_url = "https://api.fireworks.ai/inference/v1".to_string();
        }
        if model.is_empty() {
            model = "accounts/fireworks/models/llama-v3p1-8b-instruct".to_string();
        }
        provider_id = Some("fireworks".to_string());
    }

    if api_key.is_empty() && !mistral_key.is_empty() {
        api_key = mistral_key;
        if base_url.is_empty() {
            base_url = "https://api.mistral.ai/v1".to_string();
        }
        if model.is_empty() {
            model = "mistral-small-latest".to_string();
        }
        provider_id = Some("mistral".to_string());
    }

    if api_key.is_empty() && !xai_key.is_empty() {
        api_key = xai_key;
        if base_url.is_empty() {
            base_url = "https://api.x.ai/v1".to_string();
        }
        if model.is_empty() {
            model = "grok-2-latest".to_string();
        }
        provider_id = Some("xai".to_string());
    }

    if api_key.is_empty() && !cohere_key.is_empty() {
        api_key = cohere_key;
        if base_url.is_empty() {
            base_url = "https://api.cohere.ai/v1".to_string();
        }
        if model.is_empty() {
            model = "command-r-plus".to_string();
        }
        provider_id = Some("cohere".to_string());
    }

    if api_key.is_empty() && !perplexity_key.is_empty() {
        api_key = perplexity_key;
        if base_url.is_empty() {
            base_url = "https://api.perplexity.ai".to_string();
        }
        if model.is_empty() {
            model = "llama-3.1-sonar-small-128k-online".to_string();
        }
        provider_id = Some("perplexity".to_string());
    }

    if api_key.is_empty() && !huggingface_key.is_empty() {
        api_key = huggingface_key;
        if base_url.is_empty() {
            base_url = "https://router.huggingface.co/v1".to_string();
        }
        if model.is_empty() {
            model = "meta-llama/Meta-Llama-3.1-8B-Instruct".to_string();
        }
        provider_id = Some("huggingface".to_string());
    }

    if api_key.is_empty() && !replicate_key.is_empty() {
        api_key = replicate_key;
        if base_url.is_empty() {
            base_url = "https://api.replicate.com/v1".to_string();
        }
        if model.is_empty() {
            model = "meta/meta-llama-3-70b-instruct".to_string();
        }
        provider_id = Some("replicate".to_string());
    }

    if api_key.is_empty() && !deepinfra_key.is_empty() {
        api_key = deepinfra_key;
        if base_url.is_empty() {
            base_url = "https://api.deepinfra.com/v1".to_string();
        }
        if model.is_empty() {
            model = "meta-llama/Meta-Llama-3.1-8B-Instruct".to_string();
        }
        provider_id = Some("deepinfra".to_string());
    }

    if api_key.is_empty() && !nvidia_key.is_empty() {
        api_key = nvidia_key;
        if base_url.is_empty() {
            base_url = "https://integrate.api.nvidia.com/v1".to_string();
        }
        if model.is_empty() {
            model = "meta/llama-3.1-8b-instruct".to_string();
        }
        provider_id = Some("nvidia".to_string());
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
        Some("https://api.nihmadev.fun".to_string())
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
        reasoning_effort: None,
    }
}
