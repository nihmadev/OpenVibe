export const PROVIDER_TEMPLATES = [
  { id: "anthropic", name: "Anthropic", icon: "anthropic.svg", baseUrl: "https://api.anthropic.com/v1" },
  { id: "openai", name: "OpenAI", icon: "openai.svg", baseUrl: "https://api.openai.com/v1" },
  {
    id: "google",
    name: "Google",
    icon: "google.svg",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  { id: "deepseek", name: "DeepSeek", icon: "deepseek.svg", baseUrl: "https://api.deepseek.com/v1" },
  { id: "groq", name: "Groq", icon: "groq.svg", baseUrl: "https://api.groq.com/openai/v1" },
  { id: "openrouter", name: "OpenRouter", icon: "openrouter.svg", baseUrl: "https://openrouter.ai/api/v1" },
  { id: "ollama", name: "Ollama", icon: "ollama.svg", baseUrl: "http://localhost:11434/v1" },
  { id: "cerebras", name: "Cerebras", icon: "cerebras.svg", baseUrl: "https://api.cerebras.ai/v1" },
  { id: "moonshot", name: "Moonshot", icon: "moonshot.svg", baseUrl: "https://api.moonshot.cn/v1" },
  { id: "zai", name: "Z.ai", icon: "zai.svg", baseUrl: "https://api.z.ai/api/paas/v4" },
  { id: "opencode", name: "Opencode Zen", icon: "opencode.svg", baseUrl: "https://opencode.ai/zen/v1" },
  { id: "github", name: "GitHub Models", icon: "github.svg", baseUrl: "https://models.github.ai" },
];

const PROVIDERS_WITH_DARK_ICON = new Set(["openrouter", "ollama", "moonshot", "opencode", "github", "openai", "zai"]);

export function getProviderIconPath(icon: string, isLight: boolean): string {
  const id = icon.replace(".svg", "");
  if (isLight && PROVIDERS_WITH_DARK_ICON.has(id)) {
    return `icons/providers/${id}-dark.svg`;
  }
  return `icons/providers/${icon}`;
}

export interface ProviderTemplate {
  id: string;
  name: string;
  icon: string;
  baseUrl: string;
}
