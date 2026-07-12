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
        ("api.together.ai", "together"),
        ("api.fireworks.ai", "fireworks"),
        ("api.mistral.ai", "mistral"),
        ("api.x.ai", "xai"),
        ("api.cohere.ai", "cohere"),
        ("dashscope.aliyuncs.com", "qwen"),
        ("openai.azure.com", "azure-openai"),
        ("bedrock-runtime", "amazon-bedrock"),
        ("router.huggingface.co", "huggingface"),
        ("api.replicate.com", "replicate"),
        ("api.deepinfra.com", "deepinfra"),
        ("api.perplexity.ai", "perplexity"),
        ("api.endpoints.anyscale.com", "anyscale"),
        ("gateway.vercel.ai", "vercel"),
        ("api.fal.ai", "fal"),
        ("app.baseten.co", "baseten"),
        ("api.hyperbolic.xyz", "hyperbolic"),
        ("api.minimax.chat", "minimax"),
        ("integrate.api.nvidia.com", "nvidia"),
        ("api.sambanova.ai", "sambanova"),
        ("api.siliconflow.cn", "siliconcloud"),
    ];
    for (sub, id) in known {
        if base_url.contains(sub) {
            return id.to_string();
        }
    }
    "default".to_string()
}
