import { invoke } from "@tauri-apps/api/core";

export const browserService = {
  start: () => invoke("browser_start"),
  navigate: (url: string) => invoke("browser_navigate_ui", { url }),
  history: (direction: -1 | 1) => invoke("browser_history_ui", { direction }),
  reload: () => invoke("browser_reload_ui"),
  snapshot: () => invoke("browser_snapshot_ui"),
  resize: (width: number, height: number) => invoke("browser_resize_ui", { width, height }),
  setStreamActive: (active: boolean) => invoke("browser_set_ui_stream_active", { active }),
  tabs: (action: "list" | "new" | "select" | "close", targetId?: string, url?: string) =>
    invoke("browser_tabs_ui", { action, targetId, url }),
  setManualControl: (manual: boolean) => invoke("browser_set_manual_control", { manual }),
  pointer: (kind: "move" | "down" | "up" | "wheel", x: number, y: number, deltaX = 0, deltaY = 0) =>
    invoke("browser_manual_pointer", { kind, x, y, deltaX, deltaY }),
  key: (key: string, text?: string) => invoke("browser_manual_key", { key, text }),
  close: () => invoke("browser_close"),
};
