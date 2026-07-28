import { useCallback, useEffect, useMemo, useState } from "react";
import type { Provider, VibeConfig } from "../types.js";

export function useModels(
  config: VibeConfig | null,
  setConfig: React.Dispatch<React.SetStateAction<VibeConfig | null>>,
  _settingsOpen: boolean,
) {
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load enabled models immediately on mount, then refresh on config/settings changes
    window.vibe.models
      .listEnabled()
      .then((ids) => {
        setEnabledModels(new Set(ids));
      })
      .catch(console.error);
  }, []);

  const connectedModels = useMemo(() => {
    // Enabled models now use composite key "providerDbId::modelId".
    // Extract just the model id for display purposes.
    return Array.from(enabledModels).map((compositeKey) => {
      const sep = compositeKey.indexOf("::");
      const modelId = sep >= 0 ? compositeKey.slice(sep + 2) : compositeKey;
      return { id: modelId, name: modelId, compositeKey };
    });
  }, [enabledModels]);

  const handlePickModel = useCallback(
    async (id: string, providerDbId?: string) => {
      // When a providerDbId is provided, switch the active provider first
      // so requests go to the correct backend.
      if (providerDbId) {
        try {
          const providers: Provider[] = await window.vibe.providers.list();
          const provider = providers.find((p) => p.id === providerDbId);
          if (provider) {
            await window.vibe.setProvider(provider.apiKey, provider.baseUrl, id, provider.id);
            if (config) setConfig({ ...config, model: id, baseUrl: provider.baseUrl });
            return;
          }
        } catch {
          // Fall through to basic setModel
        }
      }
      window.vibe.setModel(id);
      if (config) setConfig({ ...config, model: id });
    },
    [config, setConfig],
  );

  return {
    connectedModels,
    handlePickModel,
  };
}
