import type { HistoryItem, TodoTask } from "@/workbench/common/conversation";
import type { RunFileChangeSummary } from "@/workbench/services/agent/common/agentRun";
import type { SendPayload } from "@/workbench/services/agent/common/sendPayload";
import type { ChatSummary } from "@/workbench/services/chat/common/chat";
import type { FileMatch } from "@/workbench/services/files/common/files";

export type {
  AttachmentView,
  FileMentionView,
  HistoryItem,
  TodoCheckpoint,
  TodoPriority,
  TodoStatus,
  TodoTask,
} from "@/workbench/common/conversation";

export type { Attachment, FileMention, SendPayload } from "@/workbench/services/agent/common/sendPayload";
export type { ChatSummary };

export interface ChatViewProps {
  items: HistoryItem[];
  onPickModel?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onRevert?: (id: string) => void;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
  streamingId?: string | null;
  busy?: boolean;
  cwd?: string;
}

export interface ComposerProps {
  disabled: boolean;
  workspace: string;
  onSubmit: (payload: SendPayload) => void;
  onStop: () => void;
  currentModel: string;
  onPickModel: (id: string, providerDbId?: string) => void;
  onOpenSettings?: (tab?: string) => void;
  initialText?: string;
  initialTextRevision?: number;
  rollbackActive?: boolean;
  rollbackText?: string;
  rollbackFileCount?: number;
  rollbackFilesChanged?: { path: string; content: string | null }[];
  rollbackMessagesRemoved?: number;
  onRollbackRestore?: () => void;
  providerId?: string;
  currentEffort?: string;
  onReasoningEffortChange?: (effort: string | null) => void;
  emptyState?: boolean;
}

export interface MentionState {
  active: boolean;
  start: number;
  query: string;
  selected: number;
  matches: FileMatch[];
  loading: boolean;
}

export interface EditorPart {
  type: "text" | "file";
  content: string;
  path?: string;
  isDir?: boolean;
}

export interface EmptyWorkspaceViewProps {
  projectName: string;
  onSelectPrompt: (prompt: string) => void;
}

export interface SubAgentViewProps {
  items: HistoryItem[];
  onBack: () => void;
  cwd?: string;
}

export interface TodoViewProps {
  tasks: TodoTask[];
  active?: boolean;
  changeSummary?: RunFileChangeSummary | null;
}
