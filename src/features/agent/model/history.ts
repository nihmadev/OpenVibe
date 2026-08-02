// Conversation history view-model types (owned by the agent feature).

export interface AttachmentView {
  id: string;
  kind: "file" | "image";
  name: string;
  path?: string;
  dataUrl?: string;
}

export interface FileMentionView {
  /** Display text shown in the pill (e.g. "src/components/App.tsx"). */
  display: string;
  /** Absolute path to the file/folder. */
  path: string;
  /** Whether this mention points to a directory. */
  isDir?: boolean;
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
  /** File/folder @-mentions that should be rendered as pills. */
  mentions?: FileMentionView[];
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
