// Runtime event bus shared by the Tauri adapter and browser consumers.
import type { AgentEvent } from "../common/agentEvents";

const eventListeners: Array<(event: AgentEvent) => void> = [];
const busyListeners: Array<(busy: boolean) => void> = [];

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

export function emitAgentEvent(event: AgentEvent): void {
  for (const listener of eventListeners) listener(event);
}

export function emitAgentBusy(busy: boolean): void {
  for (const listener of busyListeners) listener(busy);
}
