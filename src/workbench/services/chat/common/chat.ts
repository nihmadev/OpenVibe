// Chat message content and persisted chat shapes (owned by the chats feature).

import type { AgentSnapshotEntry, ContentPart } from "@/workbench/common/conversation";

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | ContentPart[] | null;
  name?: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
  reasoningContent?: string;
  reasoningName?: string;
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  status?: "idle" | "running" | "completed" | "error";
  pinned?: boolean;
  archived?: boolean;
  unreadAt?: number;
}

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  fileSnapshots?: AgentSnapshotEntry[];
  /** Schema stamp applied by chatMigrations; absent on legacy records. */
  schemaVersion?: number;
}
