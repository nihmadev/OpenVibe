import React from "react";
import { getFileIconUrl, getFolderIconUrl } from "../../Icons/utils.js";
import { Markdown } from "../../Markdown/Markdown.js";
import type { FileMentionView } from "../types.js";

interface Props {
  text: string;
  mentions?: FileMentionView[];
}

/**
 * Regex that matches `@` followed by a path-like token.
 *
 * A path-like token is a sequence of non-whitespace characters that contains
 * at least one `/` or `\` (to distinguish actual paths from random `@word`
 * mentions). It also allows trailing directory separators.
 *
 * This intentionally doesn't match `@single-word` to avoid false positives.
 */
const MENTION_RE = /@((?:[^\s@]*[/\\][^\s@]*)+)/g;

type Segment = { kind: "text"; value: string } | { kind: "mention"; display: string; isDir: boolean };

function parseSegments(text: string, mentions?: FileMentionView[]): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  // Build a lookup set from explicit mentions (if available) for isDir info.
  const mentionMap = new Map<string, FileMentionView>();
  if (mentions) {
    for (const m of mentions) {
      mentionMap.set(m.display.replace(/^@/, ""), m);
    }
  }

  for (const match of text.matchAll(MENTION_RE)) {
    const fullMatch = match[0]!;
    const pathText = match[1]!;
    const start = match.index!;

    // Add preceding text.
    if (start > lastIndex) {
      segments.push({ kind: "text", value: text.slice(lastIndex, start) });
    }

    // Determine if it's a directory from explicit mentions or trailing slash.
    const known = mentionMap.get(pathText);
    const isDir = known?.isDir ?? (pathText.endsWith("/") || pathText.endsWith("\\"));

    segments.push({ kind: "mention", display: pathText, isDir });
    lastIndex = start + fullMatch.length;
  }

  // Trailing text.
  if (lastIndex < text.length) {
    segments.push({ kind: "text", value: text.slice(lastIndex) });
  }

  return segments;
}

/**
 * Renders a user message. Detects `@path/to/file` patterns in the text and
 * renders them as styled pills (with icon + name), matching the look of the
 * prompt-input editor pills.
 *
 * Works both for live sessions (where `mentions` metadata is available) and
 * for restored sessions (where only the persisted text is available).
 *
 * Falls back to plain <Markdown> when there are no @-mentions in the text.
 */
export const UserMessageContent = React.memo(function UserMessageContent({ text, mentions }: Props) {
  const segments = parseSegments(text, mentions);

  // If there are no mention segments, just render plain Markdown.
  const hasMentions = segments.some((s) => s.kind === "mention");
  if (!hasMentions) {
    return <Markdown content={text} isAssistant={false} />;
  }

  return (
    <span className="user-msg-content">
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          return <Markdown key={i} content={seg.value} isAssistant={false} />;
        }
        const name = seg.display;
        const iconUrl = seg.isDir ? getFolderIconUrl(name) : getFileIconUrl(name);
        return (
          <span key={i} className="user-msg-pill">
            <img className="user-msg-pill__icon" src={iconUrl} alt="" aria-hidden="true" draggable={false} />
            <span>{name}</span>
          </span>
        );
      })}
    </span>
  );
});
