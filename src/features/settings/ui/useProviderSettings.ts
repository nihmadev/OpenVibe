import { useCallback, useEffect, useState } from "react";
import { modelsGateway, providersGateway } from "@/features/providers/infrastructure/providersGateway";
import type { Provider } from "@/features/providers/model/provider";
import { PROVIDER_TEMPLATES } from "@/features/providers/model/providerTemplates";
import type { DiscoveredModel, EditingProvider } from "./types";

export function useProviderSettings(open: boolean, onProviderChanged?: (model: string, baseUrl: string) => void) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [editing, setEditing] = useState<EditingProvider | null>(null);
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set());
  const [modelsSearch, setModelsSearch] = useState("");
  const [collapsedProviders, setCollapsedProviders] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    Promise.all([providersGateway.list(), modelsGateway.listEnabled()])
      .then(([providerList, enabled]) => {
        setProviders(providerList);
        setEnabledModels(new Set(enabled));
      })
      .catch(console.error);
  }, [open]);

  const fetchModels = useCallback(async (providerList: Provider[]): Promise<void> => {
    const connected = providerList.filter((provider) => provider.apiKey);
    if (connected.length === 0) {
      setDiscoveredModels([]);
      return;
    }
    setModelsLoading(true);
    const results: DiscoveredModel[] = [];
    await Promise.all(
      connected.map(async (provider) => {
        const template = PROVIDER_TEMPLATES.find((item) =>
          provider.baseUrl.startsWith(item.baseUrl.replace(/\/+$/, "")),
        );
        const providerId = template?.id ?? provider.id;
        const providerName = template?.name ?? provider.name;
        const providerIcon = template?.icon ?? "";
        const customHeaders = provider.headers
          ?.filter((header) => header.key?.trim())
          .map((header) => [header.key.trim(), header.value.trim()] as [string, string]);

        for (const customModel of provider.customModels ?? []) {
          const modelId = customModel.key?.trim();
          if (!modelId) continue;
          results.push({
            id: modelId,
            name: customModel.value?.trim() || modelId,
            providerId,
            providerDbId: provider.id,
            providerName,
            providerIcon,
          });
        }
        const response = await modelsGateway.fetch(
          provider.baseUrl,
          provider.apiKey,
          providerId,
          provider.modelsUrl ?? undefined,
          customHeaders,
        );
        if (!response.ok) {
          console.error("Failed to fetch models for", providerName, response.error);
          return;
        }
        const customModelIds = new Set((provider.customModels ?? []).map((model) => model.key?.trim()).filter(Boolean));
        for (const model of response.models) {
          if (!customModelIds.has(model.id)) {
            results.push({
              id: model.id,
              name: model.name,
              providerId,
              providerDbId: provider.id,
              providerName,
              providerIcon,
            });
          }
        }
      }),
    );
    setDiscoveredModels(results.sort((a, b) => a.name.localeCompare(b.name)));
    setModelsLoading(false);
  }, []);

  useEffect(() => {
    fetchModels(providers);
  }, [fetchModels, providers]);

  function toggleModel(providerDbId: string, modelId: string): void {
    const compositeKey = `${providerDbId}::${modelId}`;
    if (enabledModels.has(compositeKey) || enabledModels.has(modelId)) {
      if (enabledModels.has(compositeKey)) modelsGateway.toggleEnabled(compositeKey);
      if (enabledModels.has(modelId)) modelsGateway.toggleEnabled(modelId);
      setEnabledModels((previous) => {
        const next = new Set(previous);
        next.delete(compositeKey);
        next.delete(modelId);
        return next;
      });
      return;
    }
    modelsGateway.toggleEnabled(compositeKey).then((nowEnabled) => {
      if (nowEnabled) setEnabledModels((previous) => new Set(previous).add(compositeKey));
    });
  }

  function startEdit(provider: Provider): void {
    const template = PROVIDER_TEMPLATES.find(
      (item) => item.baseUrl === provider.baseUrl || provider.baseUrl.startsWith(item.baseUrl.replace(/\/+$/, "")),
    );
    setEditing({ template: template ?? null, custom: !template, editId: provider.id });
  }

  async function disconnect(id: string): Promise<void> {
    const deletedProvider = providers.find((provider) => provider.id === id);
    await providersGateway.delete(id);
    const remaining = providers.filter((provider) => provider.id !== id);
    setProviders(remaining);
    const { currentConfig } = await import("@/infrastructure/tauri/state");
    const wasActive =
      currentConfig?.providerId === id || (deletedProvider && currentConfig?.baseUrl === deletedProvider.baseUrl);
    if (!wasActive) return;
    const nextProvider = remaining.find((provider) => provider.apiKey);
    if (nextProvider) {
      providersGateway.setProvider(nextProvider.apiKey, nextProvider.baseUrl, nextProvider.model, nextProvider.id);
      onProviderChanged?.(nextProvider.model, nextProvider.baseUrl);
    } else {
      providersGateway.setProvider("", "", "", undefined);
      onProviderChanged?.("", "");
    }
  }

  async function connect(formData: {
    apiKey: string;
    model: string;
    baseUrl: string;
    name: string;
    customIcon: string | null;
    modelsUrl: string;
    headers: { key: string; value: string }[];
    parameters: { key: string; value: string }[];
    customModels: { key: string; value: string }[];
  }): Promise<void> {
    if (!editing) return;
    let provider: Provider;
    if (editing.editId) {
      const existing = providers.find((item) => item.id === editing.editId)!;
      provider = {
        ...existing,
        ...formData,
        name: formData.name || existing.name,
        customIcon: formData.customIcon || null,
        modelsUrl: formData.modelsUrl || null,
        headers: formData.headers.length > 0 ? formData.headers : null,
        parameters: formData.parameters.length > 0 ? formData.parameters : null,
        customModels: formData.customModels.length > 0 ? formData.customModels : null,
      };
    } else {
      provider = {
        ...formData,
        id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: formData.name || (editing.template?.name ?? "Custom"),
        description: formData.baseUrl,
        addedAt: Date.now(),
        customIcon: formData.customIcon || null,
        modelsUrl: formData.modelsUrl || null,
        headers: formData.headers.length > 0 ? formData.headers : null,
        parameters: formData.parameters.length > 0 ? formData.parameters : null,
        customModels: formData.customModels.length > 0 ? formData.customModels : null,
      };
    }
    await providersGateway.save(provider);
    setProviders((previous) => {
      const exists = previous.some((item) => item.id === provider.id);
      return exists ? previous.map((item) => (item.id === provider.id ? provider : item)) : [...previous, provider];
    });
    providersGateway.setProvider(provider.apiKey, provider.baseUrl, provider.model, provider.id);
    onProviderChanged?.(provider.model, provider.baseUrl);
    setEditing(null);
  }

  return {
    providers,
    connected: providers.filter((provider) => provider.apiKey),
    editing,
    setEditing,
    discoveredModels,
    modelsLoading,
    enabledModels,
    modelsSearch,
    setModelsSearch,
    collapsedProviders,
    setCollapsedProviders,
    toggleModel,
    startEdit,
    disconnect,
    connect,
  };
}
