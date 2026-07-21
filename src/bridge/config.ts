import { invoke } from "@tauri-apps/api/core";
import { currentConfig, setCurrentConfig } from "./state.js";
import { wrap } from "./helpers.js";

export const configBridge = {
  setModel: (model: string) => {
    if (currentConfig) currentConfig.model = model;
    return invoke("set_model", { model });
  },

  setReasoningEffort: (reasoningEffort: string | null) => {
    if (currentConfig) currentConfig.reasoningEffort = reasoningEffort ?? undefined;
    return invoke("set_reasoning_effort", { reasoningEffort });
  },

  setCwd: (cwd: string) => {
    if (currentConfig) currentConfig.cwd = cwd;
    return invoke("agent_set_cwd", { cwd });
  },

  setProvider: (apiKey: string, baseUrl: string, model: string, providerId?: string) => {
    if (currentConfig) Object.assign(currentConfig, { apiKey, baseUrl, model, providerId });
    return invoke("agent_set_provider", { apiKey, baseUrl, model, providerId });
  },

  providers: {
    list: () => invoke("providers_list"),
    save: (provider: any) => invoke("providers_save", { provider }),
    delete: (id: string) => invoke("providers_delete", { id }),
  },

  models: {
    fetch: (
      baseUrl: string,
      apiKey: string,
      providerId?: string,
      modelsUrl?: string,
      customHeaders?: [string, string][],
    ) => wrap(() => invoke("models_fetch", { baseUrl, apiKey, providerId, modelsUrl, customHeaders })),
    listDisabled: () => invoke("models_list_disabled"),
    toggleDisabled: (modelId: string) => invoke("models_toggle_disabled", { modelId }),
    listEnabled: () => invoke("models_list_enabled"),
    toggleEnabled: (modelId: string) => invoke("models_toggle_enabled", { modelId }),
  },
};
