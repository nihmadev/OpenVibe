import type { FileMatch } from "../../types.js";

export interface Attachment {
  id: string;
  kind: "file" | "image";
  /** Absolute path for file/image. */
  path?: string;
  /** Display name (basename). */
  name: string;
  /** Image data URL. */
  dataUrl?: string;
  /** Size in bytes. */
  sizeBytes?: number;
}

export interface FileMention {
  /** The display text shown in the pill (e.g. "src/components/App.tsx"). */
  display: string;
  /** Absolute path to the file/folder. */
  path: string;
  /** Whether this mention points to a directory. */
  isDir?: boolean;
}

export interface SendPayload {
  parts: import("../../types.js").ContentPart[];
  display: string;
  attachments: Attachment[];
  /** File/folder mentions that were entered as @-pills in the editor. */
  mentions?: FileMention[];
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
