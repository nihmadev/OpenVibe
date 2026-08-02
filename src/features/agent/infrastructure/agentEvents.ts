// Subscriptions to agent stream events (backed by the Tauri event bridge).
import { busyListeners, eventListeners } from "@/infrastructure/tauri/state";
import type { AgentEvent } from "../model/agentEvents";

export function onAgentEvent(cb: (e: AgentEvent) => void): () => void {
  eventListeners.push(cb);
  return () => {
    const idx = eventListeners.indexOf(cb);
    if (idx !== -1) eventListeners.splice(idx, 1);
  };
}

export function onAgentBusy(cb: (busy: boolean) => void): () => void {
  busyListeners.push(cb);
  return () => {
    const idx = busyListeners.indexOf(cb);
    if (idx !== -1) busyListeners.splice(idx, 1);
  };
}
