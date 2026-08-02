// Typed Tauri adapter for agent conversation commands.
import { invoke } from "@tauri-apps/api/core";
import type { ContentPart } from "@/features/chats/model/chat";
import type { AgentFileChange, RollbackPreview } from "../model/fileChanges";

export interface SendResult {
  ok: boolean;
  error?: string;
}

/** Raw sub-agent trace event payload as emitted by `agent_get_sub_trace`. */
export interface SubTraceEvent {
  kind: "chunk" | "tool-call" | "tool-result";
  id?: string;
  text?: string;
  name?: string;
  args?: unknown;
  ok?: boolean;
}

export const agentGateway = {
  send: async (text: string): Promise<SendResult> => {
    try {
      await invoke("agent_send", { input: text, contentParts: null });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  sendParts: async (parts: ContentPart[], display?: string): Promise<SendResult> => {
    const text = display ?? parts.map((p) => ("text" in p ? p.text : "")).join("\n");
    try {
      await invoke("agent_send", { input: text, contentParts: parts });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  updateTodo: async (context: string): Promise<SendResult> => {
    try {
      await invoke("agent_update_todo", { context });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  stop: async (): Promise<void> => {
    await invoke("agent_stop").catch(() => {});
  },

  reset: async (): Promise<void> => {
    await invoke("agent_reset").catch(() => {});
  },

  instantRevert: (index: number): Promise<RollbackPreview> =>
    invoke<RollbackPreview>("agent_instant_revert", { index }),

  revertUndo: async (): Promise<void> => {
    await invoke("agent_revert_undo").catch(() => {});
  },

  getFileChange: (toolCallId: string): Promise<AgentFileChange> =>
    invoke<AgentFileChange>("agent_file_change", { toolCallId }),

  acceptFileChange: (toolCallId: string): Promise<AgentFileChange> =>
    invoke<AgentFileChange>("agent_accept_file_change", { toolCallId }),

  rejectFileChange: (toolCallId: string): Promise<AgentFileChange> =>
    invoke<AgentFileChange>("agent_reject_file_change", { toolCallId }),

  getSubTrace: (callId: string): Promise<SubTraceEvent[]> => invoke<SubTraceEvent[]>("agent_get_sub_trace", { callId }),

  estimateContextTokens: (): Promise<ContextUsage> => invoke<ContextUsage>("estimate_context_tokens"),
};

export interface ContextUsage {
  usedTokens: number;
  maxTokens: number;
  percent: number;
}
