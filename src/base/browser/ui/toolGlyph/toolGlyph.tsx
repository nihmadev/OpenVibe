import type React from "react";
import {
  CodexEditIcon,
  CodexFolderIcon,
  CodexReadIcon,
  CodexSearchIcon,
  CodexStopIcon,
  CodexTerminalIcon,
  CodexToolIcon,
  CodexWebIcon,
} from "../icons/codexAgentIcons";
import "./toolGlyph.css";

export type ToolGlyphState = "pending" | "error" | "ok";

export function toolGlyphKind(name?: string): string {
  if (name?.startsWith("git_")) return "run";
  if (name?.startsWith("mcp__")) return "tool";
  if (name === "list_skills" || name === "read_skill" || name === "read_skill_resource") return "skill";
  if (name?.startsWith("browser_")) return "web";
  if (name === "read_file" || name === "view_file") return "read";
  if (name === "search_codebase" || name === "grep_search") return "search";
  if (name === "web_search" || name === "fetch_url") return "web";
  if (name === "run" || name === "bash" || name === "run_command") return "run";
  if (
    name === "edit_file" ||
    name === "replace_file_content" ||
    name === "multi_replace_file_content" ||
    name === "write_file" ||
    name === "write_to_file"
  )
    return "edit";
  if (name === "list_dir") return "list";
  return "tool";
}

export function ToolGlyph({ name, state }: { name?: string; state: ToolGlyphState }): React.ReactElement {
  const kind = toolGlyphKind(name);
  const Icon =
    state === "error"
      ? CodexStopIcon
      : kind === "read" || kind === "skill"
        ? CodexReadIcon
        : kind === "list"
          ? CodexFolderIcon
          : kind === "search"
            ? CodexSearchIcon
            : kind === "web"
              ? CodexWebIcon
              : kind === "edit"
                ? CodexEditIcon
                : kind === "run"
                  ? CodexTerminalIcon
                  : CodexToolIcon;

  return (
    <span className={`tool-glyph tool-glyph--${kind} tool-glyph--${state}`} aria-hidden="true">
      <Icon />
    </span>
  );
}
