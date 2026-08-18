import type { BrowserEvent } from "../common/browser";

const listeners = new Set<(event: BrowserEvent) => void>();

export function onBrowserEvent(listener: (event: BrowserEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Keep the workbench browser tab in sync with agent-owned browser sessions. */
export function onBrowserSessionVisibility(listener: (open: boolean) => void): () => void {
  return onBrowserEvent((event) => {
    if (event.type === "browser:session-started") listener(true);
    if (event.type === "browser:session-closed") listener(false);
  });
}

export function emitBrowserEvent(event: BrowserEvent): void {
  for (const listener of listeners) listener(event);
}

export function browserEventListenerCount(): number {
  return listeners.size;
}
