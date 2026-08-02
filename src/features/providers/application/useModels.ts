import { useCallback } from "react";
import { providersGateway } from "@/features/providers/infrastructure/providersGateway";
import type { Provider, VibeConfig } from "../model/provider";

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
          const providers: Provider[] = await providersGateway.list();
          const provider = providers.find((p) => p.id === providerDbId);
          if (provider) {
            await providersGateway.setProvider(provider.apiKey, provider.baseUrl, id, provider.id);
            if (config) setConfig({ ...config, model: id, baseUrl: provider.baseUrl });
            return;
          }
        } catch {
          // Fall through to basic setModel
        }
      }
      providersGateway.setModel(id);
      if (config) setConfig({ ...config, model: id });
    },
    [config, setConfig],
  );

  return {
    handlePickModel,
  };
}
