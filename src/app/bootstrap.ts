// Application bootstrap: initializes the Tauri runtime bridge, registers
// application-level policies (chat autosave/restore), and returns the initial
// agent config. Also registers the persistence backend for shared/api.

import { registerChatAutosave, restoreLastActiveChat } from "@/features/chats/application/chatPersistence";
import type { VibeConfig } from "@/features/providers/model/provider";
import { tauriKeyValueStore } from "@/infrastructure/tauri/appState";
import { initVibeBridge } from "@/infrastructure/tauri/runtimeBootstrap";
import { currentConfig } from "@/infrastructure/tauri/state";
import { registerKeyValueStore } from "@/shared/api/keyValueStore";

export type InitResult = { ok: true; config: VibeConfig } | { ok: false; error: string };

registerKeyValueStore(tauriKeyValueStore);

let chatAutosaveRegistered = false;

export async function initApp(): Promise<InitResult> {
  await initVibeBridge();
  if (!currentConfig) {
    return { ok: false, error: "Failed to load config" };
  }
  if (!chatAutosaveRegistered) {
    chatAutosaveRegistered = true;
    registerChatAutosave();
  }
  // Restore last active chat after restart / page reload. Awaited to keep the
  // original ordering: agent chat state is restored before the UI loads chats.
  await restoreLastActiveChat();
  return {
    ok: true,
    config: { ...currentConfig, apiKey: currentConfig.apiKey ? "***" : "" },
  };
}
