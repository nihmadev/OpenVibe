// Chat workspace use cases shared by app composition: switching projects and
// loading the chat list + active record without touching gateways from UI.

import type { ChatRecord, ChatSummary } from "../common/chat";
import { chatService } from "../tauri/chatService";
import { recordToItems } from "./chatHistory";

export interface ChatWorkspaceState {
  chats: ChatSummary[];
  activeChatId: string | null;
  record: ChatRecord | null;
}

/**
 * Load the chat workspace for a project: reuse the newest chat (or the chat
 * from the previous session when `restoreLastActive` is set) or create a
 * fresh one when the project has no chats yet.
 */
export async function loadChatWorkspace(options?: { restoreLastActive?: boolean }): Promise<ChatWorkspaceState> {
  const list = await chatService.list();
  if (list.length === 0) {
    const fresh = await chatService.new();
    if (!fresh) return { chats: [], activeChatId: null, record: null };
    return { chats: [fresh], activeChatId: fresh.id, record: null };
  }
  const restoredId = options?.restoreLastActive ? chatService.lastActiveChatId() : null;
  const target = (restoredId && list.find((c) => c.id === restoredId)) || list[0]!;
  const record = await chatService.open(target.id);
  return { chats: list, activeChatId: target.id, record };
}

/** List chats belonging to a specific project (used for hover previews). */
export function listProjectChats(projectId: string): Promise<ChatSummary[]> {
  return chatService.listForProject(projectId);
}

export { recordToItems };
