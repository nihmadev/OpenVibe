import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import type { VibeEvent, ConfirmPayload, ContentPart, RollbackPreview } from "./types.js";

let activeChatId: string | null = null;
let currentConfig: {
  model: string;
  baseUrl: string;
  cwd: string;
  autoApprove: boolean;
  apiKey: string;
  apiUrl?: string;
  providerId?: string;
} | null = null;

// Callback arrays replacing SessionBus
const eventListeners: Array<(e: VibeEvent) => void> = [];
const busyListeners: Array<(b: boolean) => void> = [];
const confirmListeners: Array<(r: ConfirmPayload) => void> = [];

// Tauri event listener cleanup — prevents message duplication when
// initVibeBridge() is called more than once (StrictMode, HMR, remounts)
let tauriUnlistenFns: Array<() => void> = [];
async function cleanupTauriListeners() {
  for (const fn of tauriUnlistenFns) fn();
  tauriUnlistenFns = [];
}

function emitEvent(e: VibeEvent) {
  for (const cb of eventListeners) cb(e);
}
function emitBusy(b: boolean) {
  for (const cb of busyListeners) cb(b);
}
function emitConfirm(r: ConfirmPayload) {
  for (const cb of confirmListeners) cb(r);
}

async function initVibeBridge() {
  // Load config from Rust
  const cfg = await invoke<any>("read_config").catch(() => null);
  if (!cfg) return;

  currentConfig = {
    model: cfg.model ?? "",
    baseUrl: cfg.baseUrl ?? "",
    cwd: cfg.cwd ?? "",
    autoApprove: cfg.autoApprove ?? false,
    apiKey: cfg.apiKey ?? "",
    apiUrl: cfg.apiUrl,
    providerId: cfg.providerId,
  };

  // Create Rust agent
  await invoke("agent_new", { cwd: currentConfig.cwd }).catch(() => {});

  // ---- Listen for Rust agent events and translate to VibeEvent ----
  // Clean up any previously registered Tauri listeners to prevent
  // duplicate message processing (the root cause of 2-4x message duplication)
  await cleanupTauriListeners();

  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:user", (e) => {
      emitEvent({ kind: "user", text: e.payload.text ?? "", index: e.payload.index });
    }),
  );
  tauriUnlistenFns.push(
    await listen("vibe:agent:send-complete", () => {
      // Auto-generate title if still "New chat"
      if (activeChatId) {
        invoke("chats_list")
          .then((list: any) => {
            const current = (list as any[]).find((c: any) => c.id === activeChatId);
            if (current && current.title === "New chat") {
              invoke<string>("agent_summarize").then((title) => {
                if (title && title !== "New chat") {
                  invoke("chats_rename", { id: activeChatId, title }).catch(() => {});
                }
              });
            }
          })
          .catch(() => {});
      }
    }),
  );
  tauriUnlistenFns.push(
    await listen("vibe:agent:assistant-start", () => {
      emitEvent({ kind: "assistant-start" });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:assistant-chunk", (e) => {
      emitEvent({ kind: "assistant-chunk", text: e.payload.text ?? "" });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:reasoning-chunk", (e) => {
      emitEvent({ kind: "reasoning-chunk", text: e.payload.text ?? "" });
    }),
  );
  tauriUnlistenFns.push(
    await listen("vibe:agent:reasoning-end", () => {
      emitEvent({ kind: "reasoning-end" });
    }),
  );
  tauriUnlistenFns.push(
    await listen("vibe:agent:assistant-end", () => {
      emitEvent({ kind: "assistant-end" });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:tool-call", (e) => {
      emitEvent({
        kind: "tool-call",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
        args: e.payload.args ?? {},
      });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:tool-chunk", (e) => {
      emitEvent({
        kind: "tool-chunk",
        id: e.payload.id ?? "",
        args: e.payload.args ?? "",
      });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:tool-result", (e) => {
      emitEvent({
        kind: "tool-result",
        id: e.payload.id ?? "",
        ok: e.payload.ok ?? false,
        text: e.payload.text ?? "",
      });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:tool-denied", (e) => {
      emitEvent({
        kind: "tool-denied",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
      });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:confirm-request", (e) => {
      emitConfirm({
        id: e.payload.id ?? "",
        toolName: e.payload.toolName ?? "",
        args: e.payload.args ?? {},
      });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:busy", (e) => {
      emitBusy(e.payload.busy ?? false);
    }),
  );
  tauriUnlistenFns.push(
    await listen("vibe:agent:done", async () => {
      emitEvent({ kind: "done" });
      // Save messages to chat
      if (activeChatId) {
        try {
          const msgs = await invoke("agent_get_messages");
          await invoke("chats_save", { id: activeChatId, messages: msgs });
        } catch {
          /* ignore */
        }
      }
    }),
  );
  tauriUnlistenFns.push(
    await listen("vibe:agent:stopped", () => {
      emitEvent({ kind: "stopped" });
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:agent:error", (e) => {
      emitEvent({ kind: "error", text: e.payload.text ?? "" });
    }),
  );

  // File system changes
  tauriUnlistenFns.push(
    await listen("vibe:fs:changed", () => {
      window.dispatchEvent(new CustomEvent("vibe:fs:changed"));
    }),
  );

  // Chat updates
  tauriUnlistenFns.push(
    await listen("vibe:chats:updated", () => {
      window.dispatchEvent(new CustomEvent("vibe:chats:updated"));
    }),
  );

  // Terminal events
  tauriUnlistenFns.push(
    await listen<any>("vibe:term:data", (e) => {
      window.dispatchEvent(new CustomEvent("vibe:term:data", { detail: e.payload }));
    }),
  );
  tauriUnlistenFns.push(
    await listen<any>("vibe:term:exit", (e) => {
      window.dispatchEvent(new CustomEvent("vibe:term:exit", { detail: e.payload }));
    }),
  );

  // Clean up on window unload
  window.addEventListener("beforeunload", () => {
    for (const fn of tauriUnlistenFns) fn();
    tauriUnlistenFns = [];
  });

  // Restore last active chat after restart / page reload
  try {
    const lastChatId = localStorage.getItem("openvibe:activeChatId");
    if (lastChatId) {
      const record = await invoke<any>("chats_open", { id: lastChatId });
      if (record && Array.isArray(record.messages)) {
        activeChatId = lastChatId;
        await invoke("agent_set_messages", { messages: record.messages }).catch(() => {});
        window.dispatchEvent(new CustomEvent("vibe:chat:restored", { detail: record }));
      }
    }
  } catch {
    localStorage.removeItem("openvibe:activeChatId");
  }
}

// ===== BRIDGE API =====

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

  send: async (text: string) => {
    try {
      await invoke("agent_send", { input: text, contentParts: null as any });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  },

  sendParts: async (parts: ContentPart[], display?: string) => {
    const text = display ?? parts.map((p) => ("text" in p ? p.text : "")).join("\n");
    try {
      await invoke("agent_send", { input: text, contentParts: parts });
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, error: String(e) };
    }
  },

  instantRevert: async (index: number) => {
    return await invoke<RollbackPreview>("agent_instant_revert", { index });
  },

  revertUndo: async () => {
    await invoke("agent_revert_undo").catch(() => {});
  },

  reset: async () => {
    await invoke("agent_reset").catch(() => {});
  },

  stop: async () => {
    await invoke("agent_stop").catch(() => {});
  },

  decide: async (id: string, decision: "yes" | "no" | "always") => {
    await invoke("agent_confirm", { id, decision }).catch(() => {});
  },

  pickWorkspace: async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, multiple: false });
      return folder || null;
    } catch {
      return null;
    }
  },

  window: {
    minimize: () => invoke("window_minimize"),
    maximize: () => invoke("window_maximize"),
    close: () => invoke("window_close"),
  },

  state: {
    get: (key: string) => invoke("state_get", { key }),
    set: (key: string, value: string) => invoke("state_set", { key, value }),
  },

  setModel: (model: string) => {
    if (currentConfig) currentConfig.model = model;
    return invoke("set_model", { model });
  },

  setCwd: (cwd: string) => {
    if (currentConfig) currentConfig.cwd = cwd;
    return invoke("agent_set_cwd", { cwd });
  },

  setProvider: (apiKey: string, baseUrl: string, model: string, providerId?: string) => {
    if (currentConfig) Object.assign(currentConfig, { apiKey, baseUrl, model, providerId });
    return invoke("agent_set_provider", { apiKey, baseUrl, model, providerId });
  },

  providers: {
    list: () => invoke("providers_list"),
    save: (provider: any) => invoke("providers_save", { provider }),
    delete: (id: string) => invoke("providers_delete", { id }),
  },

  models: {
    fetch: (baseUrl: string, apiKey: string, providerId?: string) =>
      wrap(() => invoke("models_fetch", { baseUrl, apiKey, providerId })),
    listDisabled: () => invoke("models_list_disabled"),
    toggleDisabled: (modelId: string) => invoke("models_toggle_disabled", { modelId }),
    listEnabled: () => invoke("models_list_enabled"),
    toggleEnabled: (modelId: string) => invoke("models_toggle_enabled", { modelId }),
  },

  chats: {
    list: () => invoke("chats_list"),
    listForProject: (projectId: string) => invoke("chats_list_for_project", { projectId }),
    new: async () => {
      if (activeChatId) {
        try {
          const msgs = await invoke<any[]>("agent_get_messages");
          const toSave = msgs.filter((m: any) => m.role !== "system");
          await invoke("chats_save", { id: activeChatId, messages: toSave });
        } catch {
          /* ignore */
        }
      }
      // Reset agent for fresh conversation
      await invoke("agent_reset").catch(() => {});

      // Create a new chat (reuses current if empty, otherwise allocates new ID)
      const result = await invoke<any>("chats_new");
      if (result) {
        activeChatId = result.id;
        localStorage.setItem("openvibe:activeChatId", result.id);
      }
      return result;
    },
    open: async (id: string) => {
      if (activeChatId && activeChatId !== id) {
        try {
          const msgs = await invoke("agent_get_messages");
          await invoke("chats_save", { id: activeChatId, messages: msgs });
        } catch {
          /* ignore */
        }
      }
      const record = await invoke<any>("chats_open", { id });
      if (!record) return null;
      activeChatId = id;
      localStorage.setItem("openvibe:activeChatId", id);
      // Restore messages into the Rust agent
      if (Array.isArray(record.messages)) {
        await invoke("agent_set_messages", { messages: record.messages }).catch(() => {});
      }
      return record;
    },
    save: async (id: string) => {
      try {
        const msgs = await invoke("agent_get_messages");
        await invoke("chats_save", { id, messages: msgs });
      } catch {
        /* ignore */
      }
    },
    delete: (id: string) => invoke("chats_delete", { id }),
    rename: (id: string, title: string) => invoke("chats_rename", { id, title }),
  },

  projects: {
    list: () => invoke("projects_list"),
    active: () => invoke("projects_active"),
    add: () => invoke("projects_add"),
    setActive: (id: string) => invoke("projects_set_active", { id }),
    remove: (id: string) => invoke("projects_remove", { id }),
    rename: (id: string, name: string) => invoke("projects_rename", { id, name }),
    setColor: (id: string, color: string) => invoke("projects_set_color", { id, color }),
    setIcon: (id: string, icon: string | null) => invoke("projects_set_icon", { id, icon }),
    setPhoto: (id: string, photo: string | null) => invoke("projects_set_photo", { id, photo }),
    close: () => invoke("projects_close"),
  },

  fs: {
    list: (dir: string) =>
      wrap(
        () => invoke("fs_list", { dir }),
        (entries) => ({ entries }),
      ),
    reveal: async (path: string) => {
      try {
        await shellOpen(path);
      } catch {
        /* ignore */
      }
    },
    read: (path: string) =>
      wrap(
        () => invoke<string>("fs_read", { path }),
        (content) => ({ content }),
      ),
    readBinary: (path: string) => wrap(() => invoke<{ data: string; size: number }>("fs_read_binary", { path })),
    write: (path: string, content: string) => wrap(() => invoke("fs_write", { path, content })),
    rename: (from: string, to: string) => wrap(() => invoke("fs_rename", { from, to })),
    delete: (filePath: string) => wrap(() => invoke("fs_delete", { path: filePath })),
    createFile: (dir: string, name: string) =>
      wrap(
        () => invoke<string>("fs_create_file", { dir, name }),
        (path) => ({ path }),
      ),
    createDir: (dir: string, name: string) =>
      wrap(
        () => invoke<string>("fs_create_dir", { dir, name }),
        (path) => ({ path }),
      ),
    find: (root: string, query: string, limit?: number) =>
      wrap(
        () => invoke("fs_find", { root, query, limit }),
        (matches) => ({ matches }),
      ),
    findAll: (root: string, query: string, limit?: number) =>
      wrap(
        () => invoke("fs_find_all", { root, query, limit }),
        (matches) => ({ matches }),
      ),
    projectInfo: (dir: string) =>
      wrap(() => invoke<{ name: string | null; version: string | null }>("fs_project_info", { dir })),
  },

  clipboard: {
    writeText: (text: string) => {
      writeText(text);
    },
  },

  whisper: {
    transcribe: (audioBase64: string, mimeType: string) =>
      wrap(() => invoke("whisper_transcribe", { audioBase64, mimeType })),
  },

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

  onConfirm: (cb: (p: ConfirmPayload) => void) => {
    confirmListeners.push(cb);
    return () => {
      const idx = confirmListeners.indexOf(cb);
      if (idx !== -1) confirmListeners.splice(idx, 1);
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

// ===== HELPERS =====

function ok<T>(data: T): { ok: true; [key: string]: any } {
  if (typeof data === "object" && data !== null) {
    return { ok: true, ...(data as any) };
  }
  return { ok: true, data };
}

function err(msg: string): { ok: false; error: string } {
  return { ok: false, error: msg };
}

async function wrap<T>(fn: () => Promise<T>, transform?: (t: T) => any): Promise<any> {
  try {
    const result = await fn();
    return ok(transform ? transform(result) : result);
  } catch (e) {
    return err(String(e));
  }
}

(window as any).vibe = vibe;
