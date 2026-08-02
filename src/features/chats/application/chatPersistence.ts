// Chat persistence policy: autosave after each completed agent turn and
// restore the last active chat on startup.
import { onAgentEvent } from "@/features/agent/infrastructure/agentEvents";
import { chatsGateway } from "../infrastructure/chatsGateway";
import type { ChatRecord } from "../model/chat";

/**
 * Persist the active conversation whenever the agent finishes a turn.
 * Returns an unsubscribe function.
 */
export function registerChatAutosave(): () => void {
  return onAgentEvent((e) => {
    if (e.kind !== "done") return;
    void chatsGateway.saveActive();
  });
}

/**
 * Restore the last active chat (messages + agent state) after an app restart.
 * Returns the restored record, or null when nothing was restored.
 */
export async function restoreLastActiveChat(): Promise<ChatRecord | null> {
  try {
    const lastChatId = chatsGateway.lastActiveChatId();
    if (!lastChatId) return null;
    const record = await chatsGateway.open(lastChatId);
    if (record) {
      window.dispatchEvent(new CustomEvent("vibe:chat:restored", { detail: record }));
    }
    return record;
  } catch {
    chatsGateway.clearLastActiveChatId();
    return null;
  }
}
