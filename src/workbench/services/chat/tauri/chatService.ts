// Typed Tauri adapter for chat persistence commands (owned by the chats feature).
import { invoke } from "@tauri-apps/api/core";
import type { ChatMessage, ChatRecord, ChatSummary } from "../common/chat";
import { activeChatId, setActiveChatId } from "./chatRuntimeState";

const ACTIVE_CHAT_KEY = "openvibe:activeChatId";

async function saveActiveChatMessages(id: string): Promise<void> {
  try {
    const msgs = await invoke<ChatMessage[]>("agent_get_messages");
    const toSave = msgs.filter((m) => m.role !== "system");
    await invoke("chats_save", { id, messages: toSave });
  } catch {
    /* ignore */
  }
}

export const chatService = {
  list: (): Promise<ChatSummary[]> => invoke<ChatSummary[]>("chats_list"),

  /** Persist the full current agent conversation into the active chat. */
  saveActive: async (): Promise<void> => {
    if (!activeChatId) return;
    try {
      const msgs = await invoke<ChatMessage[]>("agent_get_messages");
      await invoke("chats_save", { id: activeChatId, messages: msgs });
    } catch {
      /* ignore */
    }
  },

  /** Id of the chat that was active in the previous session, if any. */
  lastActiveChatId: (): string | null => localStorage.getItem(ACTIVE_CHAT_KEY),

  clearLastActiveChatId: (): void => {
    localStorage.removeItem(ACTIVE_CHAT_KEY);
  },

  listForProject: (projectId: string): Promise<ChatSummary[]> =>
    invoke<ChatSummary[]>("chats_list_for_project", { projectId }),

  new: async (): Promise<ChatSummary | null> => {
    if (activeChatId) {
      await saveActiveChatMessages(activeChatId);
    }
    // Reset agent for fresh conversation
    await invoke("agent_reset").catch(() => {});

    // Create a new chat (reuses current if empty, otherwise allocates new ID)
    const result = await invoke<ChatSummary | null>("chats_new");
    if (result) {
      setActiveChatId(result.id);
      localStorage.setItem(ACTIVE_CHAT_KEY, result.id);
    }
    return result;
  },

  open: async (id: string): Promise<ChatRecord | null> => {
    if (activeChatId && activeChatId !== id) {
      await saveActiveChatMessages(activeChatId);
    }
    const record = await invoke<ChatRecord | null>("chats_open", { id });
    if (!record) return null;
    setActiveChatId(id);
    localStorage.setItem(ACTIVE_CHAT_KEY, id);
    // Restore messages into the Rust agent
    if (Array.isArray(record.messages)) {
      await invoke("agent_set_chat_state", {
        messages: record.messages,
        fileSnapshots: record.fileSnapshots ?? [],
      }).catch(() => {});
    }
    return record;
  },

  delete: (id: string): Promise<void> => invoke("chats_delete", { id }),

  rename: (id: string, title: string): Promise<void> => invoke("chats_rename", { id, title }),
};

/** Subscribe to backend chat-list updates. */
export function onChatsUpdated(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("vibe:chats:updated", handler);
  return () => window.removeEventListener("vibe:chats:updated", handler);
}
