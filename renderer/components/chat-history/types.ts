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
  ok?: boolean;
  attachments?: AttachmentView[];
  models?: Array<{ id: string; name: string }>;
  currentModel?: string;
  reasoning?: string;
  reasoningDone?: boolean;
  msgIndex?: number;
}

export interface Props {
  items: HistoryItem[];
  onPickModel?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onRevert?: (id: string) => void;
  streamingId?: string | null;
  busy?: boolean;
  cwd?: string;
}
