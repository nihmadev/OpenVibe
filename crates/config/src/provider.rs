pub fn derive_provider_id(base_url: &str) -> String {
    let known: &[(&str, &str)] = &[
        ("generativelanguage.googleapis.com", "google"),
        ("api.groq.com", "groq"),
        ("api.cerebras.ai", "cerebras"),
        ("api.anthropic.com", "anthropic"),
        ("api.openai.com", "openai"),
        ("api.deepseek.com", "deepseek"),
        ("openrouter.ai", "openrouter"),
        ("api.moonshot.cn", "moonshot"),
        ("api.moonshot.ai", "moonshot"),
        ("api.z.ai", "zai"),
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
