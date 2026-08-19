// Typed Tauri adapter for terminal session commands.
import { invoke } from "@tauri-apps/api/core";
import type { TerminalDataEvent, TerminalExitEvent } from "../common/terminal";

export const terminalService = {
  start: (id: string, cols: number, rows: number): Promise<boolean> =>
    invoke<boolean>("term_start", { id, cols, rows }),
  write: (id: string, data: string): Promise<void> => invoke("term_write", { id, data }),
  resize: (id: string, cols: number, rows: number): Promise<void> => invoke("term_resize", { id, cols, rows }),
  kill: (id: string): Promise<void> => invoke("term_kill", { id }),
  onData: (cb: (payload: TerminalDataEvent) => void): (() => void) => {
    const handler = (e: Event) => cb((e as CustomEvent<TerminalDataEvent>).detail);
    window.addEventListener("vibe:term:data", handler);
    return () => window.removeEventListener("vibe:term:data", handler);
  },
  onExit: (cb: (payload: TerminalExitEvent) => void): (() => void) => {
    const handler = (e: Event) => cb((e as CustomEvent<TerminalExitEvent>).detail);
    window.addEventListener("vibe:term:exit", handler);
    return () => window.removeEventListener("vibe:term:exit", handler);
  },
};
