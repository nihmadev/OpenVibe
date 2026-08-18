// Bridges backend filesystem/chat/terminal notifications to in-window DOM
// events. The DOM CustomEvent channel is the existing contract consumed by
// file, chat, and terminal services.
import { listen } from "@tauri-apps/api/event";
import { addTauriUnlistenFn } from "./listenerRegistry";

interface TermDataPayload {
  id: string;
  chunk: string;
}

interface TermExitPayload {
  id: string;
  code: number;
}

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
