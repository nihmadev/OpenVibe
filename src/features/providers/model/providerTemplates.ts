export const PROVIDER_TEMPLATES = [
  { id: "anthropic", name: "Anthropic", icon: "anthropic.svg", baseUrl: "https://api.anthropic.com/v1" },
  {
    id: "openai",
    name: "OpenAI",
    icon: "openai.svg",
    baseUrl: "https://api.openai.com/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "google",
    name: "Google",
    icon: "google.svg",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "deepseek.svg",
    baseUrl: "https://api.deepseek.com/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "groq",
    name: "Groq",
    icon: "groq.svg",
    baseUrl: "https://api.groq.com/openai/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    icon: "openrouter.svg",
    baseUrl: "https://openrouter.ai/api/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  { id: "ollama", name: "Ollama", icon: "ollama.svg", baseUrl: "http://localhost:11434/v1" },
  {
    id: "cerebras",
    name: "Cerebras",
    icon: "cerebras.svg",
    baseUrl: "https://api.cerebras.ai/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  { id: "moonshot", name: "Moonshot", icon: "moonshot.svg", baseUrl: "https://api.moonshot.cn/v1" },
  { id: "zai", name: "Z.ai", icon: "zai.svg", baseUrl: "https://api.z.ai/api/paas/v4" },
  {
    id: "opencode",
    name: "Opencode Zen",
    icon: "opencode.svg",
    baseUrl: "https://opencode.ai/zen/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "github",
    name: "GitHub Models",
    icon: "github.svg",
    baseUrl: "https://models.github.ai",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "together",
    name: "Together AI",
    icon: "together.svg",
    baseUrl: "https://api.together.ai/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    icon: "fireworks.svg",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    icon: "mistral.svg",
    baseUrl: "https://api.mistral.ai/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    icon: "xai.svg",
    baseUrl: "https://api.x.ai/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  { id: "cohere", name: "Cohere", icon: "cohere.svg", baseUrl: "https://api.cohere.ai/v1" },
  { id: "qwen", name: "Alibaba (Qwen)", icon: "qwen.svg", baseUrl: "https://dashscope.aliyuncs.com/api/v1" },
  {
    id: "azure-openai",
    name: "Azure OpenAI",
    icon: "azure-openai.svg",
    baseUrl: "https://{resource}.openai.azure.com",
  },
  {
    id: "amazon-bedrock",
    name: "AWS Bedrock",
    icon: "amazon-bedrock.svg",
    baseUrl: "https://bedrock-runtime.{region}.amazonaws.com",
  },
  { id: "huggingface", name: "Hugging Face", icon: "huggingface.svg", baseUrl: "https://router.huggingface.co/v1" },
  { id: "replicate", name: "Replicate", icon: "replicate.svg", baseUrl: "https://api.replicate.com/v1" },
  {
    id: "deepinfra",
    name: "DeepInfra",
    icon: "deepinfra.svg",
    baseUrl: "https://api.deepinfra.com/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  { id: "perplexity", name: "Perplexity AI", icon: "perplexity.svg", baseUrl: "https://api.perplexity.ai" },
  { id: "anyscale", name: "Anyscale", icon: "anyscale.svg", baseUrl: "https://api.endpoints.anyscale.com/v1" },
  { id: "vercel", name: "Vercel AI Gateway", icon: "vercel.svg", baseUrl: "https://gateway.vercel.ai/v1" },
  { id: "fal", name: "FalAI", icon: "fal.svg", baseUrl: "https://api.fal.ai/v1" },
  { id: "baseten", name: "Baseten", icon: "baseten.svg", baseUrl: "https://app.baseten.co/v1" },
  {
    id: "hyperbolic",
    name: "Hyperbolic",
    icon: "hyperbolic.svg",
    baseUrl: "https://api.hyperbolic.xyz/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  { id: "minimax", name: "MiniMax", icon: "minimax.svg", baseUrl: "https://api.minimax.chat/v1" },
  {
    id: "nvidia",
    name: "NVIDIA",
    icon: "nvidia.svg",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "sambanova",
    name: "SambaNova",
    icon: "sambanova.svg",
    baseUrl: "https://api.sambanova.ai/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
  {
    id: "siliconcloud",
    name: "SiliconCloud",
    icon: "siliconcloud.svg",
    baseUrl: "https://api.siliconflow.cn/v1",
    reasoningEffort: ["low", "medium", "high"],
  },
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
  modelsUrl?: string;
  reasoningEffort?: string[];
}

const REASONING_MODEL_PATTERNS = [
  /o[13]-/,
  /^gpt-5/i,
  /deepseek-reasoner/i,
  /deepseek-r1/i,
  /deepseek-v[34]/i,
  /grok-3/i,
  /grok-v3/i,
  /claude-sonnet-5/i,
  /claude-opus-5/i,
];

export function getReasoningEfforts(providerId: string, modelId: string): string[] | null {
  const template = PROVIDER_TEMPLATES.find((t) => t.id === providerId);
  if (template?.reasoningEffort) return template.reasoningEffort;
  const matchesPattern = REASONING_MODEL_PATTERNS.some((p) => p.test(modelId));
  if (matchesPattern) return ["low", "medium", "high"];
  return null;
}
