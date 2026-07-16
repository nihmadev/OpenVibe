import { invoke } from "@tauri-apps/api/core";
import { activeChatId, setActiveChatId } from "./state.js";
import type { ContentPart, RollbackPreview } from "../types.js";

export const chatsBridge = {
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
        setActiveChatId(result.id);
        localStorage.setItem("openvibe:activeChatId", result.id);
      }
      return result;
    },
    open: async (id: string) => {
      if (activeChatId && activeChatId !== id) {
        try {
          const msgs = await invoke<any[]>("agent_get_messages");
          const toSave = msgs.filter((m: any) => m.role !== "system");
          await invoke("chats_save", { id: activeChatId, messages: toSave });
        } catch {
          /* ignore */
        }
      }
      const record = await invoke<any>("chats_open", { id });
      if (!record) return null;
      setActiveChatId(id);
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
};
