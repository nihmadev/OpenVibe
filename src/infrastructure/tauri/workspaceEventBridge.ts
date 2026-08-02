// Bridges backend filesystem/chat/terminal notifications to in-window DOM
// events. The DOM CustomEvent channel is the existing contract that feature
// adapters (fsGateway.onFsChanged, chatsGateway.onChatsUpdated,
// terminalGateway.onData/onExit) subscribe to.
import { listen } from "@tauri-apps/api/event";
import type { TermDataPayload, TermExitPayload } from "@/features/terminal/infrastructure/terminalGateway";
import { addTauriUnlistenFn } from "./state";

export async function registerWorkspaceEventBridge(): Promise<void> {
  // File system changes
  addTauriUnlistenFn(
    await listen("vibe:fs:changed", () => {
      window.dispatchEvent(new CustomEvent("vibe:fs:changed"));
    }),
  );

  // Chat updates
  addTauriUnlistenFn(
    await listen("vibe:chats:updated", () => {
      window.dispatchEvent(new CustomEvent("vibe:chats:updated"));
    }),
  );

  // Terminal events
  addTauriUnlistenFn(
    await listen<TermDataPayload>("vibe:term:data", (e) => {
      window.dispatchEvent(new CustomEvent<TermDataPayload>("vibe:term:data", { detail: e.payload }));
    }),
  );
  addTauriUnlistenFn(
    await listen<TermExitPayload>("vibe:term:exit", (e) => {
      window.dispatchEvent(new CustomEvent<TermExitPayload>("vibe:term:exit", { detail: e.payload }));
    }),
  );
}
