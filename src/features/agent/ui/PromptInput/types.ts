import type { FileMatch } from "@/features/files/model/fs";

export type { Attachment, FileMention, SendPayload } from "../../model/sendPayload";

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
