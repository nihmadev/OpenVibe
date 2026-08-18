import type { ProviderTemplate } from "../common/aiProvider";
import type { ModelsDevCatalog, ModelsDevModel, ModelsDevProvider } from "../common/modelsDevCatalog";

const CACHE_DB = "openvibe-modelsdev";
const CACHE_STORE = "catalog";
const CACHE_RECORD = "canonical";
const LEGACY_CACHE_KEY = "openvibe_modelsdev_catalog";
const LEGACY_LAST_SYNC_KEY = "openvibe_modelsdev_last_sync";
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CatalogCacheRecord {
  id: typeof CACHE_RECORD;
  catalog: ModelsDevCatalog;
  syncedAt: number;
}

function isCatalog(value: unknown): value is ModelsDevCatalog {
  return !!value && typeof value === "object" && Object.keys(value).length > 10;
}

function openCatalogDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(CACHE_STORE)) request.result.createObjectStore(CACHE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function readCatalogCache(): Promise<CatalogCacheRecord | null> {
  const db = await openCatalogDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const transaction = db.transaction(CACHE_STORE, "readonly");
    const request = transaction.objectStore(CACHE_STORE).get(CACHE_RECORD);
    request.onsuccess = () => {
      const value = request.result as CatalogCacheRecord | undefined;
      resolve(value && isCatalog(value.catalog) ? value : null);
      db.close();
    };
    request.onerror = () => {
      resolve(null);
      db.close();
    };
  });
}

async function writeCatalogCache(catalog: ModelsDevCatalog, syncedAt: number): Promise<void> {
  const db = await openCatalogDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(CACHE_STORE, "readwrite");
    transaction.objectStore(CACHE_STORE).put({ id: CACHE_RECORD, catalog, syncedAt }, CACHE_RECORD);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  db.close();
}

function replaceCatalog(target: ModelsDevCatalog, source: ModelsDevCatalog): void {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, source);
}

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
  private catalog: ModelsDevCatalog | null = null;
  private initialization: Promise<ModelsDevCatalog> | null = null;
  private syncPromise: Promise<boolean> | null = null;
  private lastSync = 0;

  public initialize(): Promise<ModelsDevCatalog> {
    return this.ensureInitialized(true);
  }

  private ensureInitialized(scheduleSync: boolean): Promise<ModelsDevCatalog> {
    if (this.catalog) return Promise.resolve(this.catalog);
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      const cached = await readCatalogCache();
      if (cached) {
        this.catalog = cached.catalog;
        this.lastSync = cached.syncedAt;
      } else {
        const bundled = await import("../data/modelsDevCatalog.json");
        this.catalog = bundled.default as unknown as ModelsDevCatalog;
      }
      try {
        localStorage.removeItem(LEGACY_CACHE_KEY);
        localStorage.removeItem(LEGACY_LAST_SYNC_KEY);
      } catch {
        // Legacy synchronous cache may be unavailable.
      }
      if (scheduleSync && typeof window !== "undefined") {
        setTimeout(() => void this.syncWithRemote(), 2000);
      }
      return this.catalog;
    })();
    return this.initialization;
  }

  public async syncWithRemote(force = false): Promise<boolean> {
    if (this.syncPromise) return this.syncPromise;
    if (typeof fetch === "undefined") return false;
    await this.ensureInitialized(false);
    if (this.syncPromise) return this.syncPromise;
    if (!force && Date.now() - this.lastSync < SYNC_INTERVAL_MS) return false;

    this.syncPromise = (async () => {
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
        if (!isCatalog(data)) return false;
        if (this.catalog) replaceCatalog(this.catalog, data);
        else this.catalog = data;
        this.lastSync = Date.now();
        void writeCatalogCache(this.catalog, this.lastSync);
        return true;
      } catch {
        // Network failed or offline; the cached or bundled snapshot remains canonical.
        return false;
      } finally {
        this.syncPromise = null;
      }
    })();
    return this.syncPromise;
  }

  public async getCatalog(): Promise<ModelsDevCatalog> {
    return this.initialize();
  }

  public getProvider(id: string): ModelsDevProvider | undefined {
    const catalog = this.catalog;
    if (!catalog) return undefined;
    const direct = catalog[id];
    if (direct) return direct;
    const mapped = PROVIDER_ALIAS_MAP[id];
    if (mapped && catalog[mapped]) return catalog[mapped];
    const reverse = REVERSE_ALIAS_MAP[id];
    if (reverse && catalog[reverse]) return catalog[reverse];
    return undefined;
  }

  public findProviderByUrl(baseUrl: string): ModelsDevProvider | undefined {
    if (!baseUrl) return undefined;
    const cleanUrl = baseUrl.replace(/\/+$/, "").toLowerCase();

    // 1. Direct match on models.dev api field
    for (const p of Object.values(this.catalog ?? {})) {
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
    for (const p of Object.values(this.catalog ?? {})) {
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
    for (const [id, p] of Object.entries(this.catalog ?? {})) {
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
    for (const p of Object.values(this.catalog ?? {})) {
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
