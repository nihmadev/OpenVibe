// Provider configuration use cases (application boundary over the gateway).
import { modelsGateway, providersGateway } from "../infrastructure/providersGateway";
import type { Provider } from "../model/provider";

/** Point the agent at a new working directory. */
export function changeWorkingDirectory(cwd: string): Promise<void> {
  return providersGateway.setCwd(cwd);
}

/** Persist the reasoning effort choice on the backend. */
export function updateReasoningEffort(effort: string | null): Promise<void> {
  return providersGateway.setReasoningEffort(effort);
}

/**
 * Restore the provider that was active in the previous session and prewarm
 * the enabled-models cache. Returns the restored provider, or null.
 */
export async function restoreLastProvider(): Promise<Provider | null> {
  const [providerList] = await Promise.all([
    providersGateway.list(),
    // Preload enabled models in background to avoid lazy load on first interaction
    modelsGateway.listEnabled().catch(() => []),
  ]);
  if (providerList.length === 0) return null;
  const active = providerList[providerList.length - 1]!;
  void providersGateway.setProvider(active.apiKey, active.baseUrl, active.model, active.id);
  return active;
}
