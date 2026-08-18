import type { ProviderTemplate } from "../common/aiProvider";
import type { ModelsDevCatalog, ModelsDevModel, ModelsDevProvider } from "../common/modelsDevCatalog";
import bundledCatalogRaw from "../data/modelsDevCatalog.json";

const BUNDLED_CATALOG = bundledCatalogRaw as unknown as ModelsDevCatalog;

const CACHE_KEY = "openvibe_modelsdev_catalog";
const LAST_SYNC_KEY = "openvibe_modelsdev_last_sync";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Canonical mapping between legacy OpenVibe IDs and models.dev IDs
export const PROVIDER_ALIAS_MAP: Record<string, string> = {
  together: "togetherai",
  fireworks: "fireworks-ai",
  moonshot: "moonshotai",
  siliconcloud: "siliconflow",
  qwen: "alibaba",
  zai: "zai",
  github: "github-copilot",
  "azure-openai": "azure",
  "amazon-bedrock": "amazon-bedrock",
};

// Reverse mapping for looking up legacy IDs
export const REVERSE_ALIAS_MAP: Record<string, string> = {
  togetherai: "together",
  "fireworks-ai": "fireworks",
  moonshotai: "moonshot",
  siliconflow: "siliconcloud",
  alibaba: "qwen",
  "github-copilot": "github",
  azure: "azure-openai",
};

// Fallback base URLs for standard SDK providers where api URL is omitted in models.dev
export const STANDARD_BASE_URLS: Record<string, string> = {
  anthropic: "https://api.anthropic.com/v1",
  openai: "https://api.openai.com/v1",
  google: "https://generativelanguage.googleapis.com/v1beta/openai",
  deepseek: "https://api.deepseek.com/v1",
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  ollama: "http://localhost:11434/v1",
  "ollama-cloud": "https://ollama.com/v1",
  lmstudio: "http://localhost:1234/v1",
  cerebras: "https://api.cerebras.ai/v1",
  moonshot: "https://api.moonshot.cn/v1",
  moonshotai: "https://api.moonshot.ai/v1",
  zai: "https://api.z.ai/api/paas/v4",
  opencode: "https://opencode.ai/zen/v1",
  github: "https://models.github.ai",
  "github-copilot": "https://models.github.ai",
  together: "https://api.together.ai/v1",
  togetherai: "https://api.together.ai/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  "fireworks-ai": "https://api.fireworks.ai/inference/v1",
  mistral: "https://api.mistral.ai/v1",
  xai: "https://api.x.ai/v1",
  cohere: "https://api.cohere.ai/v1",
  qwen: "https://dashscope.aliyuncs.com/api/v1",
  alibaba: "https://dashscope.aliyuncs.com/api/v1",
  "azure-openai": "https://{resource}.openai.azure.com",
  azure: "https://{resource}.openai.azure.com",
  "amazon-bedrock": "https://bedrock-runtime.{region}.amazonaws.com",
  huggingface: "https://router.huggingface.co/v1",
  replicate: "https://api.replicate.com/v1",
  deepinfra: "https://api.deepinfra.com/v1",
  perplexity: "https://api.perplexity.ai",
  anyscale: "https://api.endpoints.anyscale.com/v1",
  vercel: "https://gateway.vercel.ai/v1",
  fal: "https://api.fal.ai/v1",
  baseten: "https://app.baseten.co/v1",
  hyperbolic: "https://api.hyperbolic.xyz/v1",
  minimax: "https://api.minimax.chat/v1",
  nvidia: "https://integrate.api.nvidia.com/v1",
  sambanova: "https://api.sambanova.ai/v1",
  siliconcloud: "https://api.siliconflow.cn/v1",
  siliconflow: "https://api.siliconflow.com/v1",
};

// Priority ordering for prominent providers shown at top of lists
const POPULAR_PROVIDER_ORDER = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "groq",
  "openrouter",
  "ollama",
  "cerebras",
  "mistral",
  "xai",
  "togetherai",
  "fireworks-ai",
  "moonshotai",
  "zai",
  "opencode",
  "github-copilot",
  "alibaba",
  "siliconflow",
  "deepinfra",
  "perplexity",
  "cohere",
  "nvidia",
  "minimax",
  "sambanova",
  "hyperbolic",
  "azure",
  "amazon-bedrock",
  "huggingface",
  "replicate",
  "baseten",
  "fal",
  "vercel",
  "anyscale",
];

const REASONING_MODEL_PATTERNS = [
  /o[13]-/i,
  /^o[13]$/i,
  /^gpt-5/i,
  /deepseek-reasoner/i,
  /deepseek-r1/i,
  /deepseek-v[34]/i,
  /grok-3/i,
  /grok-v3/i,
  /grok-4/i,
  /claude-3-7-sonnet/i,
  /claude-sonnet-3-7/i,
  /claude-sonnet-5/i,
  /claude-opus-5/i,
  /qwq/i,
  /thinking/i,
];

class ModelsDevService {
  private catalog: ModelsDevCatalog;
  private isSyncing = false;

  constructor() {
    this.catalog = this.loadInitialCatalog();
    // Schedule background sync
    if (typeof window !== "undefined") {
      setTimeout(() => {
        this.syncWithRemote().catch(() => {});
      }, 2000);
    }
  }

  private loadInitialCatalog(): ModelsDevCatalog {
    if (typeof localStorage === "undefined") {
      return BUNDLED_CATALOG;
    }
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          return { ...BUNDLED_CATALOG, ...parsed };
        }
      }
    } catch {
      // Fallback to bundled
    }
    return BUNDLED_CATALOG;
  }

  public async syncWithRemote(force = false): Promise<boolean> {
    if (this.isSyncing || typeof fetch === "undefined") return false;
    if (!force && typeof localStorage !== "undefined") {
      const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY) || "0");
      if (Date.now() - lastSync < SYNC_INTERVAL_MS) {
        return false;
      }
    }

    this.isSyncing = true;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      const res = await fetch("https://models.dev/api.json", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeoutId);

      if (!res.ok) return false;
      const data = (await res.json()) as ModelsDevCatalog;
      if (data && typeof data === "object" && Object.keys(data).length > 10) {
        this.catalog = { ...BUNDLED_CATALOG, ...data };
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
          } catch {
            // Storage quota exceeded or disabled
          }
        }
        return true;
      }
    } catch {
      // Network failed or offline, bundled snapshot is active
    } finally {
      this.isSyncing = false;
    }
    return false;
  }

  public getCatalog(): ModelsDevCatalog {
    return this.catalog;
  }

  public getProvider(id: string): ModelsDevProvider | undefined {
    const direct = this.catalog[id];
    if (direct) return direct;
    const mapped = PROVIDER_ALIAS_MAP[id];
    if (mapped && this.catalog[mapped]) return this.catalog[mapped];
    const reverse = REVERSE_ALIAS_MAP[id];
    if (reverse && this.catalog[reverse]) return this.catalog[reverse];
    return undefined;
  }

  public findProviderByUrl(baseUrl: string): ModelsDevProvider | undefined {
    if (!baseUrl) return undefined;
    const cleanUrl = baseUrl.replace(/\/+$/, "").toLowerCase();

    // 1. Direct match on models.dev api field
    for (const p of Object.values(this.catalog)) {
      if (p.api && cleanUrl.startsWith(p.api.replace(/\/+$/, "").toLowerCase())) {
        return p;
      }
    }

    // 2. Match on STANDARD_BASE_URLS
    for (const [id, url] of Object.entries(STANDARD_BASE_URLS)) {
      if (cleanUrl.startsWith(url.replace(/\/+$/, "").toLowerCase())) {
        return this.getProvider(id);
      }
    }

    // 3. Substring match on host domain
    for (const p of Object.values(this.catalog)) {
      const pid = p.id.toLowerCase();
      if (cleanUrl.includes(pid)) {
        return p;
      }
    }

    return undefined;
  }

  public getProviders(): ProviderTemplate[] {
    const templatesMap = new Map<string, ProviderTemplate>();

    // 1. Add popular / known templates first in order
    for (const popId of POPULAR_PROVIDER_ORDER) {
      const p = this.getProvider(popId);
      const canonicalId = REVERSE_ALIAS_MAP[popId] ?? popId;
      const baseUrl =
        p?.api || STANDARD_BASE_URLS[canonicalId] || STANDARD_BASE_URLS[popId] || `https://api.${canonicalId}.com/v1`;
      const name = p?.name || canonicalId.charAt(0).toUpperCase() + canonicalId.slice(1);
      templatesMap.set(canonicalId, {
        id: canonicalId,
        name,
        icon: `${canonicalId}.svg`,
        baseUrl,
        modelsUrl: undefined,
        docUrl: p?.doc,
        env: p?.env,
      });
    }

    // 2. Add local providers that may not be in models.dev (e.g. local Ollama / LM Studio)
    if (!templatesMap.has("ollama")) {
      templatesMap.set("ollama", {
        id: "ollama",
        name: "Ollama",
        icon: "ollama.svg",
        baseUrl: "http://localhost:11434/v1",
      });
    }

    // 3. Add remaining providers from models.dev catalog
    for (const [id, p] of Object.entries(this.catalog)) {
      const canonicalId = REVERSE_ALIAS_MAP[id] ?? id;
      if (templatesMap.has(canonicalId)) continue;
      const baseUrl = p.api || STANDARD_BASE_URLS[canonicalId] || STANDARD_BASE_URLS[id] || `https://api.${id}.com/v1`;
      templatesMap.set(canonicalId, {
        id: canonicalId,
        name: p.name || canonicalId,
        icon: `${canonicalId}.svg`,
        baseUrl,
        modelsUrl: undefined,
        docUrl: p.doc,
        env: p.env,
      });
    }

    return Array.from(templatesMap.values());
  }

  public getModel(modelId: string, providerId?: string): ModelsDevModel | undefined {
    if (!modelId) return undefined;
    const cleanModelId = modelId.toLowerCase();

    // 1. If providerId specified, look in that provider first
    if (providerId) {
      const p = this.getProvider(providerId);
      if (p?.models) {
        if (p.models[modelId]) return p.models[modelId];
        // Suffix/prefix match
        for (const [mid, m] of Object.entries(p.models)) {
          if (mid.toLowerCase() === cleanModelId || mid.endsWith(`/${modelId}`) || modelId.endsWith(`/${mid}`)) {
            return m;
          }
        }
      }
    }

    // 2. Global search across catalog
    for (const p of Object.values(this.catalog)) {
      if (!p.models) continue;
      if (p.models[modelId]) return p.models[modelId];
      for (const [mid, m] of Object.entries(p.models)) {
        if (mid.toLowerCase() === cleanModelId || mid.endsWith(`/${modelId}`) || modelId.endsWith(`/${mid}`)) {
          return m;
        }
      }
    }

    return undefined;
  }

  public getReasoningEfforts(providerId?: string, modelId?: string): string[] | null {
    if (modelId) {
      const model = this.getModel(modelId, providerId);
      if (model?.reasoning_options && model.reasoning_options.length > 0) {
        for (const opt of model.reasoning_options) {
          if (opt.type === "effort" && opt.values && opt.values.length > 0) {
            // Filter out 'none' if present or map values
            return opt.values.filter((v) => v !== "none");
          }
          if (opt.type === "toggle") {
            return ["low", "medium", "high"];
          }
        }
      }
      if (model?.reasoning === true) {
        return ["low", "medium", "high"];
      }

      // Regex fallback for known reasoning models
      const matchesPattern = REASONING_MODEL_PATTERNS.some((p) => p.test(modelId));
      if (matchesPattern) {
        return ["low", "medium", "high"];
      }
    }

    // Provider level check
    if (providerId) {
      const p = this.getProvider(providerId);
      const canonicalId = REVERSE_ALIAS_MAP[providerId] ?? providerId;
      const providersWithReasoning = new Set([
        "openai",
        "deepseek",
        "groq",
        "openrouter",
        "cerebras",
        "together",
        "togetherai",
        "fireworks",
        "fireworks-ai",
        "mistral",
        "xai",
        "hyperbolic",
        "nvidia",
        "sambanova",
        "siliconcloud",
        "siliconflow",
        "opencode",
        "github",
        "github-copilot",
      ]);
      if (providersWithReasoning.has(canonicalId) || (p && providersWithReasoning.has(p.id))) {
        return ["low", "medium", "high"];
      }
    }

    return null;
  }

  public getModelContextLimit(modelId: string, providerId?: string): number {
    const model = this.getModel(modelId, providerId);
    if (model?.limit?.context) {
      return model.limit.context;
    }
    const clean = modelId.toLowerCase();
    if (clean.includes("gemini") && (clean.includes("pro") || clean.includes("flash"))) return 1048576;
    if (clean.includes("claude-3-5") || clean.includes("claude-3-7") || clean.includes("claude-4")) return 200000;
    if (clean.includes("gpt-4.5") || clean.includes("o3-mini")) return 200000;
    if (clean.includes("gpt-4o") || clean.includes("o1") || clean.includes("deepseek")) return 128000;
    return 128000;
  }

  public supportsVision(modelId: string, providerId?: string): boolean {
    const model = this.getModel(modelId, providerId);
    if (model) {
      if (model.modalities?.input?.includes("image") || model.attachment === true) {
        return true;
      }
    }
    const m = modelId.toLowerCase();
    return (
      m.includes("vision") ||
      m.includes("-vl") ||
      m.includes("_vl") ||
      m.includes("vl-") ||
      m.includes("multimodal") ||
      m.includes("gpt-4o") ||
      m.includes("gpt-4-turbo") ||
      m.includes("o1") ||
      m.includes("o3") ||
      m.includes("claude-3") ||
      m.includes("claude-4") ||
      m.includes("gemini") ||
      m.includes("pixtral") ||
      m.includes("llava")
    );
  }
}

export const modelsDevService = new ModelsDevService();
