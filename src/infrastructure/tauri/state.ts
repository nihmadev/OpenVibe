import type { AgentEvent } from "@/features/agent/model/agentEvents";
import type { VibeConfig } from "@/features/providers/model/provider";

export let activeChatId: string | null = null;
export function setActiveChatId(id: string | null) {
  activeChatId = id;
}

export let currentConfig: VibeConfig | null = null;
export function setCurrentConfig(cfg: VibeConfig | null) {
  currentConfig = cfg;
}

export const eventListeners: Array<(e: AgentEvent) => void> = [];
export const busyListeners: Array<(b: boolean) => void> = [];

export function emitEvent(e: AgentEvent) {
  for (const cb of eventListeners) cb(e);
}
export function emitBusy(b: boolean) {
  for (const cb of busyListeners) cb(b);
}

export let tauriUnlistenFns: Array<() => void> = [];
export async function cleanupTauriListeners() {
  for (const fn of tauriUnlistenFns) fn();
  tauriUnlistenFns = [];
}
export function addTauriUnlistenFn(fn: () => void) {
  tauriUnlistenFns.push(fn);
}
export function addBeforeUnloadCleanup() {
  window.addEventListener("beforeunload", () => {
    cleanupTauriListeners();
  });
}
