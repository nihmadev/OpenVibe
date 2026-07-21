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

export interface SendPayload {
  parts: import("../../types.js").ContentPart[];
  display: string;
  attachments: Attachment[];
}

export interface MentionState {
  active: boolean;
  start: number;
  query: string;
  selected: number;
  matches: FileMatch[];
  loading: boolean;
}

/** A part in the contenteditable editor */
export interface EditorPart {
  type: "text" | "file";
  content: string;
  path?: string;
}
