import type { BrowserEvent } from "../common/browser";

const listeners = new Set<(event: BrowserEvent) => void>();

export function onBrowserEvent(listener: (event: BrowserEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitBrowserEvent(event: BrowserEvent): void {
  for (const listener of listeners) listener(event);
}

export function browserEventListenerCount(): number {
  return listeners.size;
}
