export interface AttachmentView {
  id: string;
  kind: "file" | "image";
  name: string;
  path?: string;
  dataUrl?: string;
}

export interface HistoryItem {
  id: string;
  kind: "user" | "assistant" | "tool" | "info" | "error" | "model-picker" | "stopped";
  text: string;
  toolName?: string;
  toolArgs?: unknown;
  toolStream?: string;
  ok?: boolean;
  attachments?: AttachmentView[];
  models?: Array<{ id: string; name: string }>;
  currentModel?: string;
  reasoning?: string;
  reasoningDone?: boolean;
  reasoningName?: string;
  msgIndex?: number;
  subItems?: HistoryItem[];
  startedAt?: number;
  completedAt?: number;
  /** Transient context used to render a meaningful todo activity. */
  todoPreviousTasks?: TodoTask[];
}

export type TodoStatus = "pending" | "in_progress" | "blocked" | "waiting_user" | "completed" | "skipped";
export type TodoPriority = "critical" | "high" | "normal" | "low";

export interface TodoTask {
  id?: string;
  title: string;
  status: TodoStatus;
  priority?: TodoPriority;
  order?: number;
  dependsOn?: string[];
  acceptanceCriteria?: string[];
  nextAction?: string;
  blocker?: string;
  evidence?: string[];
  owner?: "agent" | "user" | "subagent";
  userLocked?: boolean;
}

export interface TodoCheckpoint {
  goal?: string;
  summary?: string;
  nextAction?: string;
  blockers?: string[];
  constraints?: string[];
  changedFiles?: string[];
}

export interface Props {
  items: HistoryItem[];
  onPickModel?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onRevert?: (id: string) => void;
  onDrillDown?: (id: string) => void;
  streamingId?: string | null;
  busy?: boolean;
  cwd?: string;
}
