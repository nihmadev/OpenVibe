import type { FileMatch } from "../../types.js";

export interface SlashCommand {
  name: string;
  description: string;
}

export function getSlashCommands(t: (key: string) => string): SlashCommand[] {
  return [
    { name: "/help", description: t("slashHelp") },
    { name: "/clear", description: t("slashClear") },
    { name: "/reset", description: t("slashReset") },
    { name: "/cwd", description: t("slashPwd") },
    { name: "/model", description: t("slashModel") },
    { name: "/test", description: t("slashTest") },
    { name: "/exit", description: t("slashExit") },
  ];
}

export interface Attachment {
  id: string;
  kind: "file" | "image";
  /** Absolute path for file/image. */
  path?: string;
  /** Display name (basename). */
  name: string;
  /** Image data URL. */
  dataUrl?: string;
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
