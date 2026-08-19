// Chat persistence policy: autosave after each completed agent turn and
// restore the last active chat on startup.

import type { ChatRecord } from "../common/chat";
import { chatService } from "../tauri/chatService";

export type SubscribeCompletedAgentTurn = (listener: () => void) => () => void;

/**
 * Persist the active conversation whenever the agent finishes a turn.
 * Returns an unsubscribe function.
 */
export function registerChatAutosave(subscribe: SubscribeCompletedAgentTurn): () => void {
  return subscribe(() => {
    void chatService.saveActive();
  });
}

/**
 * Restore the last active chat (messages + agent state) after an app restart.
 * Returns the restored record, or null when nothing was restored.
 */
export async function restoreLastActiveChat(): Promise<ChatRecord | null> {
  try {
    const lastChatId = chatService.lastActiveChatId();
    if (!lastChatId) return null;
    const record = await chatService.open(lastChatId);
    if (record) {
      window.dispatchEvent(new CustomEvent("vibe:chat:restored", { detail: record }));
    }
    return record;
  } catch {
    chatService.clearLastActiveChatId();
    return null;
  }
}
