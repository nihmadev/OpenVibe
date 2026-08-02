// Runtime bootstrap: loads config from Rust, creates the agent, and wires all
// Tauri event bridges. Application policies (chat autosave/restore) are
// registered by the app bootstrap, not here.
import { invoke } from "@tauri-apps/api/core";
import { registerAgentEventBridge } from "./agentEventBridge";
import { addBeforeUnloadCleanup, cleanupTauriListeners, currentConfig, setCurrentConfig } from "./state";
import { registerWorkspaceEventBridge } from "./workspaceEventBridge";

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

export async function initVibeBridge(): Promise<void> {
  // Load config from Rust
  const cfg = await invoke<RawConfig>("read_config").catch(() => null);
  if (!cfg) return;

  setCurrentConfig({
    model: cfg.model ?? "",
    baseUrl: cfg.baseUrl ?? "",
    cwd: cfg.cwd ?? "",
    autoApprove: cfg.autoApprove ?? false,
    apiKey: cfg.apiKey ?? "",
    apiUrl: cfg.apiUrl,
    providerId: cfg.providerId,
    reasoningEffort: cfg.reasoningEffort ?? undefined,
  });

  // Create Rust agent
  await invoke("agent_new", { cwd: currentConfig?.cwd }).catch(() => {});

  // Reset listeners (hot reload safety), then wire typed event bridges
  await cleanupTauriListeners();
  await registerAgentEventBridge();
  await registerWorkspaceEventBridge();
  addBeforeUnloadCleanup();
}
