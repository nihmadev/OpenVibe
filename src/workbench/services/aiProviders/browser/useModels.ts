import { useCallback } from "react";
import { aiProviderService } from "@/workbench/services/aiProviders/tauri/aiProviderService";
import type { Provider, VibeConfig } from "../common/aiProvider";

export function useModels(
  config: VibeConfig | null,
  setConfig: React.Dispatch<React.SetStateAction<VibeConfig | null>>,
  _settingsOpen: boolean,
) {
  const handlePickModel = useCallback(
    async (id: string, providerDbId?: string) => {
      // When a providerDbId is provided, switch the active provider first
      // so requests go to the correct backend.
      if (providerDbId) {
        try {
          const providers: Provider[] = await aiProviderService.listProviders();
          const provider = providers.find((p) => p.id === providerDbId);
          if (provider) {
            await aiProviderService.setProvider(provider.apiKey, provider.baseUrl, id, provider.id);
            if (config) setConfig({ ...config, model: id, baseUrl: provider.baseUrl });
            return;
          }
        } catch {
          // Fall through to basic setModel
        }
      }
      aiProviderService.setModel(id);
      if (config) setConfig({ ...config, model: id });
    },
    [config, setConfig],
  );

  return {
    handlePickModel,
  };
}
