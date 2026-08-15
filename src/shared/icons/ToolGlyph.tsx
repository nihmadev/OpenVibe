import type React from "react";
import "../ui/tool-glyph.css";

export type ToolGlyphState = "pending" | "error" | "ok";

function toolGlyphKind(name?: string): string {
  if (name?.startsWith("git_")) return "git";
  if (name?.startsWith("mcp__")) return "mcp";
  if (name === "read_file" || name === "view_file") return "read";
  if (name === "search_codebase" || name === "grep_search") return "search";
  if (name === "web_search" || name === "fetch_url") return "web";
  if (name === "run" || name === "bash" || name === "run_command") return "run";
  if (name === "edit_file" || name === "replace_file_content" || name === "multi_replace_file_content") return "edit";
  if (name === "write_file" || name === "write_to_file") return "write";
  if (name === "list_dir") return "list";
  if (name === "agent") return "agent";
  return "tool";
}

export function ToolGlyph({ name, state }: { name?: string; state: ToolGlyphState }): React.ReactElement {
  const kind = toolGlyphKind(name);
  return (
    <span className={`tool-glyph tool-glyph--${kind} tool-glyph--${state}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {state === "error" ? (
          <path d="M6 6l12 12m0-12L6 18" />
        ) : kind === "read" ? (
          <>
            <path d="M3.5 8c3.2 0 5.8 1 8.5 3v9.5c-2.7-1.9-5.3-2.8-8.5-2.8zM20.5 8c-3.2 0-5.8 1-8.5 3v9.5c2.7-1.9 5.3-2.8 8.5-2.8z" />
            <path d="M12 5v16" />
            <path d="M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 0 4 2 5 5 0 0 0 4-2z" />
          </>
        ) : kind === "search" ? (
          <>
            <circle cx="10.5" cy="10.5" r="7.5" />
            <path d="m16 16 5 5" />
          </>
        ) : kind === "web" ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3.5 12h17M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3" />
          </>
        ) : kind === "run" ? (
          <>
            <rect x="2.5" y="3.5" width="19" height="17" rx="3" />
            <path d="m6.5 9 3 3-3 3M12.5 15h4.5" />
          </>
        ) : kind === "edit" ? (
          <path d="m4 20 1.6-5.7L16.9 3a2.2 2.2 0 0 1 3.1 0l1 1a2.2 2.2 0 0 1 0 3.1L9.7 18.4zM15.5 4.5l4 4M5.6 14.3l4.1 4.1" />
        ) : kind === "write" ? (
          <>
            <path d="M4 2.5h10l5 5v14H4zM14 2.5v5h5" />
            <path d="m7 17 1-3 6.5-6.5 2 2L10 16z" />
          </>
        ) : kind === "list" ? (
          <path
            d="M2.5 8.5A2.5 2.5 0 0 1 5 6h4l2 2h8a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5zM3 9h18"
            fill="none"
          />
        ) : kind === "agent" ? (
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5zM8 11h8M8 15h5" />
        ) : kind === "git" ? (
          <path
            fill="currentColor"
            stroke="none"
            d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z"
          />
        ) : kind === "mcp" ? (
          <>
            <rect x="3" y="3" width="7" height="7" rx="2" />
            <rect x="14" y="14" width="7" height="7" rx="2" />
            <path d="m9 9 6 6M16 3v5h5M3 16h5v5" />
          </>
        ) : (
          <path d="M12 3v18M3 12h18M5.5 5.5l13 13m0-13-13 13" />
        )}
      </svg>
    </span>
  );
}
