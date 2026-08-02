// UI-facing props for the AgentChat component. History view-model types live
// in the agent feature model; re-export them for local component imports.
import type { HistoryItem } from "../../model/history";

export type {
  AttachmentView,
  FileMentionView,
  HistoryItem,
  TodoCheckpoint,
  TodoPriority,
  TodoStatus,
  TodoTask,
} from "../../model/history";

export interface Props {
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
