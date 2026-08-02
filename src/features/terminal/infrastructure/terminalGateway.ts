// Typed Tauri adapter for terminal session commands.
import { invoke } from "@tauri-apps/api/core";

export interface TermDataPayload {
  id: string;
  chunk: string;
}

export interface TermExitPayload {
  id: string;
  code: number;
}

export const terminalGateway = {
  start: (id: string, cols: number, rows: number): Promise<boolean> =>
    invoke<boolean>("term_start", { id, cols, rows }),
  write: (id: string, data: string): Promise<void> => invoke("term_write", { id, data }),
  resize: (id: string, cols: number, rows: number): Promise<void> => invoke("term_resize", { id, cols, rows }),
  kill: (id: string): Promise<void> => invoke("term_kill", { id }),
  onData: (cb: (payload: TermDataPayload) => void): (() => void) => {
    const handler = (e: Event) => cb((e as CustomEvent<TermDataPayload>).detail);
    window.addEventListener("vibe:term:data", handler);
    return () => window.removeEventListener("vibe:term:data", handler);
  },
  onExit: (cb: (payload: TermExitPayload) => void): (() => void) => {
    const handler = (e: Event) => cb((e as CustomEvent<TermExitPayload>).detail);
    window.addEventListener("vibe:term:exit", handler);
    return () => window.removeEventListener("vibe:term:exit", handler);
  },
};
