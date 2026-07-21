import type { VibeEvent } from "../types.js";

export let activeChatId: string | null = null;
export function setActiveChatId(id: string | null) {
  activeChatId = id;
}

export let currentConfig: {
  model: string;
  baseUrl: string;
  cwd: string;
  autoApprove: boolean;
  apiKey: string;
  apiUrl?: string;
  providerId?: string;
  reasoningEffort?: string;
} | null = null;
export function setCurrentConfig(cfg: typeof currentConfig) {
  currentConfig = cfg;
}

export const eventListeners: Array<(e: VibeEvent) => void> = [];
export const busyListeners: Array<(b: boolean) => void> = [];

export function emitEvent(e: VibeEvent) {
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
