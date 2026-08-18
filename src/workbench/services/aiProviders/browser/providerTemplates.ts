import type { ProviderTemplate } from "../common/aiProvider";
import { modelsDevService, PROVIDER_ALIAS_MAP, REVERSE_ALIAS_MAP } from "./modelsDevService";

export const PROVIDER_TEMPLATES: ProviderTemplate[] = modelsDevService.getProviders();

export const LOCAL_PROVIDER_ICONS = new Set([
  "amazon-bedrock",
  "anthropic",
  "anyscale",
  "azure-openai",
  "azure",
  "baseten",
  "cerebras",
  "cohere",
  "deepinfra",
  "deepseek",
  "fal",
  "fireworks",
  "fireworks-ai",
  "github",
  "github-copilot",
  "google",
  "groq",
  "huggingface",
  "hyperbolic",
  "minimax",
  "mistral",
  "moonshot",
  "moonshotai",
  "nvidia",
  "ollama",
  "openai",
  "opencode",
  "openrouter",
  "perplexity",
  "qwen",
  "alibaba",
  "replicate",
  "sambanova",
  "siliconcloud",
  "siliconflow",
  "together",
  "togetherai",
  "vercel",
  "xai",
  "zai",
]);

const PROVIDERS_WITH_DARK_ICON = new Set(["openrouter", "ollama", "moonshot", "opencode", "github", "openai", "zai"]);

/**
 * Returns remote vector logo from models.dev with fallback support.
 */
export function getProviderIconUrl(providerIdOrIcon: string, isLight = false): string {
  if (!providerIdOrIcon) return "";
  if (
    providerIdOrIcon.startsWith("http://") ||
    providerIdOrIcon.startsWith("https://") ||
    providerIdOrIcon.startsWith("data:")
  ) {
    return providerIdOrIcon;
  }
  const cleanId = providerIdOrIcon
    .replace(/\.svg$/i, "")
    .replace(/\.webp$/i, "")
    .toLowerCase();
  const canonicalLocal = REVERSE_ALIAS_MAP[cleanId] ?? cleanId;

  // Prefer high-quality, full-color local SVG if available
  if (LOCAL_PROVIDER_ICONS.has(canonicalLocal) || LOCAL_PROVIDER_ICONS.has(cleanId)) {
    return getProviderIconPath(cleanId, isLight);
  }

  const remoteId = PROVIDER_ALIAS_MAP[cleanId] ?? cleanId;
  return `https://models.dev/logos/${remoteId}.svg`;
}

/**
 * Returns local bundled full-color icon path for offline/fallback rendering.
 */
export function getProviderIconPath(icon: string, isLight: boolean): string {
  if (!icon) return "";
  if (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("data:")) {
    return icon;
  }
  const cleanId = icon
    .replace(/\.svg$/i, "")
    .replace(/\.webp$/i, "")
    .toLowerCase();
  const canonicalLocal = REVERSE_ALIAS_MAP[cleanId] ?? cleanId;

  if (LOCAL_PROVIDER_ICONS.has(canonicalLocal)) {
    if (isLight && PROVIDERS_WITH_DARK_ICON.has(canonicalLocal)) {
      return `icons/providers/${canonicalLocal}-dark.svg`;
    }
    return `icons/providers/${canonicalLocal}.svg`;
  }

  if (LOCAL_PROVIDER_ICONS.has(cleanId)) {
    if (isLight && PROVIDERS_WITH_DARK_ICON.has(cleanId)) {
      return `icons/providers/${cleanId}-dark.svg`;
    }
    return `icons/providers/${cleanId}.svg`;
  }

  const remoteId = PROVIDER_ALIAS_MAP[cleanId] ?? cleanId;
  return `https://models.dev/logos/${remoteId}.svg`;
}

/**
 * Resolves reasoning effort levels for given provider and model from models.dev catalog.
 */
export function getReasoningEfforts(providerId: string, modelId: string): string[] | null {
  return modelsDevService.getReasoningEfforts(providerId, modelId);
}
