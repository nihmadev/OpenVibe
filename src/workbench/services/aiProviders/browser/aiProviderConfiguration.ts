// Provider configuration use cases (application boundary over the gateway).

import type { Provider } from "../common/aiProvider";
import { aiProviderService } from "../tauri/aiProviderService";

/** Point the agent at a new working directory. */
export function changeWorkingDirectory(cwd: string): Promise<void> {
  return aiProviderService.setCwd(cwd);
}

/** Persist the reasoning effort choice on the backend. */
export function updateReasoningEffort(effort: string | null): Promise<void> {
  return aiProviderService.setReasoningEffort(effort);
}

/**
 * Restore the provider that was active in the previous session and prewarm
 * the enabled-models cache. Returns the restored provider, or null.
 */
export async function restoreLastProvider(): Promise<Provider | null> {
  const [providerList] = await Promise.all([
    aiProviderService.listProviders(),
    // Preload enabled models in background to avoid lazy load on first interaction
    aiProviderService.listEnabledModels().catch(() => []),
  ]);
  if (providerList.length === 0) return null;
  const active = providerList[providerList.length - 1]!;
  void aiProviderService.setProvider(active.apiKey, active.baseUrl, active.model, active.id);
  return active;
}
