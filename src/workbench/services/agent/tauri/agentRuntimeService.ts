// Agent runtime initialization. Event bridges are registered explicitly by
// the desktop composition root.
import { invoke } from "@tauri-apps/api/core";
import type { VibeConfig } from "@/workbench/services/aiProviders/common/aiProvider";
import { setCurrentConfig } from "@/workbench/services/aiProviders/tauri/aiProviderRuntimeState";

interface RawConfig {
  model?: string;
  baseUrl?: string;
  cwd?: string;
  autoApprove?: boolean;
  apiKey?: string;
  apiUrl?: string;
  providerId?: string;
  reasoningEffort?: string;
}

export async function initializeAgentRuntime(): Promise<void> {
  // Load config from Rust
  const cfg = await invoke<RawConfig>("read_config").catch(() => null);
  if (!cfg) return;

  const config: VibeConfig = {
    model: cfg.model ?? "",
    baseUrl: cfg.baseUrl ?? "",
    cwd: cfg.cwd ?? "",
    autoApprove: cfg.autoApprove ?? false,
    apiKey: cfg.apiKey ?? "",
    apiUrl: cfg.apiUrl,
    providerId: cfg.providerId,
    reasoningEffort: cfg.reasoningEffort ?? undefined,
  };
  setCurrentConfig(config);

  // Create Rust agent
  await invoke("agent_new", { cwd: config.cwd }).catch(() => {});
}
