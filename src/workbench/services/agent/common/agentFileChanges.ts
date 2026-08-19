// File snapshot / rollback contracts for agent-driven edits.

export interface FileSnapshot {
  path: string;
  content: string | null;
}

export interface RollbackPreview {
  filesChanged: FileSnapshot[];
  messagesRemoved: number;
}

export type AgentFileChangeStatus = "pending" | "accepted" | "rejected";

export interface AgentFileChange {
  toolCallId: string;
  path: string;
  beforeContent: string | null;
  afterContent: string | null;
  status: AgentFileChangeStatus;
}
