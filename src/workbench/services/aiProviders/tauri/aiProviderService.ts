// Typed Tauri adapter for provider/model configuration commands.
import { invoke } from "@tauri-apps/api/core";
import { type Result, wrap } from "@/platform/native/common/nativeResult";
import { modelsDevService } from "../browser/modelsDevService";
import type { ModelInfo, Provider } from "../common/aiProvider";
import { getCurrentConfig } from "./aiProviderRuntimeState";

const enabledModelsListeners = new Set<() => void>();

function notifyEnabledModelsChanged(): void {
  for (const listener of enabledModelsListeners) listener();
}

export const aiProviderService = {
  setModel: (model: string): Promise<void> => {
    const currentConfig = getCurrentConfig();
    if (currentConfig) currentConfig.model = model;
    return invoke("set_model", { model });
  },

  setReasoningEffort: (reasoningEffort: string | null): Promise<void> => {
    const currentConfig = getCurrentConfig();
    if (currentConfig) currentConfig.reasoningEffort = reasoningEffort ?? undefined;
    return invoke("set_reasoning_effort", { reasoningEffort });
  },

  setCwd: (cwd: string): Promise<void> => {
    const currentConfig = getCurrentConfig();
    if (currentConfig) currentConfig.cwd = cwd;
    return invoke("agent_set_cwd", { cwd });
  },

  setProvider: (apiKey: string, baseUrl: string, model: string, providerId?: string): Promise<void> => {
    const currentConfig = getCurrentConfig();
    if (currentConfig) Object.assign(currentConfig, { apiKey, baseUrl, model, providerId });
    return invoke("agent_set_provider", { apiKey, baseUrl, model, providerId });
  },

  listProviders: (): Promise<Provider[]> => invoke<Provider[]>("providers_list"),
  saveProvider: (provider: Provider): Promise<void> => invoke("providers_save", { provider }),
  deleteProvider: (id: string): Promise<void> => invoke("providers_delete", { id }),

  fetchModels: async (
    baseUrl: string,
    apiKey: string,
    providerId?: string,
    modelsUrl?: string,
    customHeaders?: [string, string][],
  ): Promise<Result<{ models: ModelInfo[] }>> => {
    const res = await wrap(
      () => invoke<{ models: ModelInfo[] }>("models_fetch", { baseUrl, apiKey, providerId, modelsUrl, customHeaders }),
      (r) => r,
    );
    if (!res.ok) return res;

    const enriched = res.models.map((m) => {
      const meta = modelsDevService.getModel(m.id, providerId);
      return {
        ...m,
        description: meta?.description ?? m.description,
        contextLimit: meta?.limit?.context ?? modelsDevService.getModelContextLimit(m.id, providerId),
        outputLimit: meta?.limit?.output,
        supportsVision: modelsDevService.supportsVision(m.id, providerId),
        supportsReasoning: !!(meta?.reasoning || meta?.reasoning_options?.length),
        cost: meta?.cost
          ? {
              input: meta.cost.input,
              output: meta.cost.output,
              cache_read: meta.cost.cache_read,
            }
          : undefined,
      };
    });

    return { ok: true, models: enriched };
  },
  listDisabledModels: (): Promise<string[]> => invoke<string[]>("models_list_disabled"),
  toggleDisabledModel: (modelId: string): Promise<boolean> => invoke<boolean>("models_toggle_disabled", { modelId }),
  listEnabledModels: (): Promise<string[]> => invoke<string[]>("models_list_enabled"),
  toggleEnabledModel: async (modelId: string): Promise<boolean> => {
    const enabled = await invoke<boolean>("models_toggle_enabled", { modelId });
    notifyEnabledModelsChanged();
    return enabled;
  },
  onEnabledModelsChange: (listener: () => void): (() => void) => {
    enabledModelsListeners.add(listener);
    return () => enabledModelsListeners.delete(listener);
  },
};
