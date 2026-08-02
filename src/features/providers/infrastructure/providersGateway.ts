// Typed Tauri adapter for provider/model configuration commands.
import { invoke } from "@tauri-apps/api/core";
import { type Result, wrap } from "@/infrastructure/tauri/helpers";
import { currentConfig } from "@/infrastructure/tauri/state";
import type { ModelInfo, Provider } from "../model/provider";

export const providersGateway = {
  setModel: (model: string): Promise<void> => {
    if (currentConfig) currentConfig.model = model;
    return invoke("set_model", { model });
  },

  setReasoningEffort: (reasoningEffort: string | null): Promise<void> => {
    if (currentConfig) currentConfig.reasoningEffort = reasoningEffort ?? undefined;
    return invoke("set_reasoning_effort", { reasoningEffort });
  },

  setCwd: (cwd: string): Promise<void> => {
    if (currentConfig) currentConfig.cwd = cwd;
    return invoke("agent_set_cwd", { cwd });
  },

  setProvider: (apiKey: string, baseUrl: string, model: string, providerId?: string): Promise<void> => {
    if (currentConfig) Object.assign(currentConfig, { apiKey, baseUrl, model, providerId });
    return invoke("agent_set_provider", { apiKey, baseUrl, model, providerId });
  },

  list: (): Promise<Provider[]> => invoke<Provider[]>("providers_list"),
  save: (provider: Provider): Promise<void> => invoke("providers_save", { provider }),
  delete: (id: string): Promise<void> => invoke("providers_delete", { id }),
};

export const modelsGateway = {
  fetch: (
    baseUrl: string,
    apiKey: string,
    providerId?: string,
    modelsUrl?: string,
    customHeaders?: [string, string][],
  ): Promise<Result<{ models: ModelInfo[] }>> =>
    wrap(
      () => invoke<{ models: ModelInfo[] }>("models_fetch", { baseUrl, apiKey, providerId, modelsUrl, customHeaders }),
      (r) => r,
    ),
  listDisabled: (): Promise<string[]> => invoke<string[]>("models_list_disabled"),
  toggleDisabled: (modelId: string): Promise<boolean> => invoke<boolean>("models_toggle_disabled", { modelId }),
  listEnabled: (): Promise<string[]> => invoke<string[]>("models_list_enabled"),
  toggleEnabled: (modelId: string): Promise<boolean> => invoke<boolean>("models_toggle_enabled", { modelId }),
};
