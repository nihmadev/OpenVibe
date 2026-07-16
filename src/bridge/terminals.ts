import { invoke } from "@tauri-apps/api/core";

export const terminalsBridge = {
  term: {
    start: (id: string, cols: number, rows: number) => invoke("term_start", { id, cols, rows }),
    write: (id: string, data: string) => invoke("term_write", { id, data }),
    resize: (id: string, cols: number, rows: number) => invoke("term_resize", { id, cols, rows }),
    kill: (id: string) => invoke("term_kill", { id }),
    onData: (cb: (payload: any) => void) => {
      const handler = (e: Event) => cb((e as CustomEvent).detail);
      window.addEventListener("vibe:term:data", handler);
      return () => window.removeEventListener("vibe:term:data", handler);
    },
    onExit: (cb: (payload: any) => void) => {
      const handler = (e: Event) => cb((e as CustomEvent).detail);
      window.addEventListener("vibe:term:exit", handler);
      return () => window.removeEventListener("vibe:term:exit", handler);
    },
  },
};
