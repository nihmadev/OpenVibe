import { initVibeBridge } from "./bridge/events.js";
import { currentConfig, eventListeners, busyListeners } from "./bridge/state.js";
import { chatsBridge } from "./bridge/chats.js";
import { configBridge } from "./bridge/config.js";
import { projectsBridge } from "./bridge/projects.js";
import { filesBridge } from "./bridge/files.js";
import { gitBridge } from "./bridge/git.js";
import { terminalsBridge } from "./bridge/terminals.js";
import type { VibeEvent } from "./types.js";

export const vibe = {
  init: async () => {
    await initVibeBridge();
    if (!currentConfig) {
      return { ok: false, error: "Failed to load config" };
    }
    return {
      ok: true,
      config: { ...currentConfig, apiKey: currentConfig.apiKey ? "***" : "" },
    };
  },

  ...chatsBridge,
  ...configBridge,
  ...projectsBridge,
  ...filesBridge,
  ...gitBridge,
  ...terminalsBridge,

  onEvent: (cb: (e: VibeEvent) => void) => {
    eventListeners.push(cb);
    return () => {
      const idx = eventListeners.indexOf(cb);
      if (idx !== -1) eventListeners.splice(idx, 1);
    };
  },

  onBusy: (cb: (busy: boolean) => void) => {
    busyListeners.push(cb);
    return () => {
      const idx = busyListeners.indexOf(cb);
      if (idx !== -1) busyListeners.splice(idx, 1);
    };
  },

  onChatsUpdated: (cb: () => void) => {
    const handler = () => cb();
    window.addEventListener("vibe:chats:updated", handler);
    return () => window.removeEventListener("vibe:chats:updated", handler);
  },

  onFsChanged: (cb: (paths?: string[]) => void) => {
    const handler = () => cb();
    window.addEventListener("vibe:fs:changed", handler);
    return () => window.removeEventListener("vibe:fs:changed", handler);
  },
};

(window as any).vibe = vibe;

export {
  mcpGetServers,
  mcpStartServer,
  mcpStopServer,
  mcpRestartServer,
  mcpGetStatus,
  mcpGetConfig,
  mcpSaveConfig,
  mcpListTools,
  pushScg2Events,
  type SCG2EventBatch,
} from "./bridge/mcp.js";
