import React, { useEffect, useRef, useMemo, useState } from "react";
import "../../styles/History.css";
import "../../styles/Tool.css";
import "../../styles/FBadge.css";
import { useI18n } from "../../hooks/useI18n.js";

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
}

function formatArgs(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return "";
  }
}

interface FileBadgeInfo {
  name: string;
  ext: string;
  cls: string;
}

const EXT_COLORS: Record<string, string> = {
  ts: "ts",
  tsx: "ts",
  js: "js",
  jsx: "js",
  mjs: "js",
  cjs: "js",
  json: "json",
  md: "md",
  py: "py",
  rs: "rs",
  go: "go",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "cs",
  rb: "rb",
  php: "php",
  html: "html",
  htm: "html",
  css: "css",
  scss: "css",
  sh: "sh",
  bash: "sh",
  ps1: "sh",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  xml: "xml",
  sql: "sql",
};

function basename(p: string): string {
  const m = /[\\/]([^\\/]+)$/.exec(p);
  return m?.[1] ?? p;
}

function pickFile(args: unknown): FileBadgeInfo | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  const raw =
    typeof a.path === "string"
      ? a.path
      : typeof a.file === "string"
        ? a.file
        : null;
  if (!raw) return null;
  const name = basename(raw);
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return { name, ext, cls: EXT_COLORS[ext] ?? "" };
}

interface DiffLine {
  type: "add" | "remove";
  text: string;
}

interface DiffInfo {
  added: number;
  removed: number;
  lines: DiffLine[];
}

function computeDiff(item: HistoryItem): DiffInfo | null {
  if (item.kind !== "tool") return null;
  const args = item.toolArgs as Record<string, unknown> | undefined;
  if (!args) return null;
  if (item.toolName === "edit_file") {
    const oldStr = String(args.old_str ?? "");
    const newStr = String(args.new_str ?? "");
    const oldLines = oldStr === "" ? [] : oldStr.split("\n");
    const newLines = newStr === "" ? [] : newStr.split("\n");
    const maxLines = 15;
    const lines: DiffLine[] = [];
    for (const line of oldLines) { if (lines.length >= maxLines) break; lines.push({ type: "remove", text: line }); }
    for (const line of newLines) { if (lines.length >= maxLines) break; lines.push({ type: "add", text: line }); }
    return { added: newLines.length, removed: oldLines.length, lines };
  }
  if (item.toolName === "write_file") {
    const content = String(args.content ?? "");
    const contentLines = content === "" ? [] : content.split("\n");
    const maxLines = 15;
    const lines: DiffLine[] = [];
    for (let i = 0; i < Math.min(contentLines.length, maxLines); i++) {
      lines.push({ type: "add", text: contentLines[i]! });
    }
    return { added: contentLines.length, removed: 0, lines };
  }
  return null;
}

function describe(item: HistoryItem): { verb: string; file: FileBadgeInfo | null; suffix: string } {
  const file = pickFile(item.toolArgs);
  switch (item.toolName) {
    case "read_file":
      return { verb: "Read", file, suffix: "" };
    case "write_file":
      return {
        verb: item.ok === false ? "Failed to write" : "Created",
        file,
        suffix: "",
      };
    case "edit_file":
      return {
        verb: item.ok === false ? "Failed to edit" : "Edited",
        file,
        suffix: "",
      };
    case "list_dir": {
      const args = item.toolArgs as { path?: string } | undefined;
      const path = args?.path ?? ".";
      return {
        verb: "Listed",
        file: { name: basename(path) || path, ext: "", cls: "dir" },
        suffix: "",
      };
    }
    case "search_codebase": {
      const args = item.toolArgs as { query?: string } | undefined;
      const text = args?.query ?? "";
      return {
        verb: "Searched",
        file: null,
        suffix: text ? `"${text}"` : "",
      };
    }
    case "bash": {
      const args = item.toolArgs as { command?: string } | undefined;
      return {
        verb: "Ran",
        file: null,
        suffix: args?.command ?? "",
      };
    }
    default:
      return { verb: item.toolName ?? "Tool", file, suffix: "" };
  }
}

function FileBadge({ info }: { info: FileBadgeInfo }): React.ReactElement {
  const iconFile = info.ext ? ICON_MAP_HISTORY[info.ext] : null;
  return (
    <span className="fbadge">
      {iconFile ? (
        <img className="fbadge__icon" src={`./img/${iconFile}`} alt="" draggable={false} />
      ) : info.cls === "dir" ? (
        <span className="fbadge__dir">📁</span>
      ) : (
        <span className="fbadge__generic">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#888" strokeWidth="1.3" strokeLinejoin="round">
            <path d="M3 1.5h6.5L13 5v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2.5a1 1 0 0 1 1-1z" />
            <path d="M9.5 1.5V5h3.5" fill="none" />
          </svg>
        </span>
      )}
      <span className="fbadge__name">{info.name}</span>
    </span>
  );
}

const ICON_MAP_HISTORY: Record<string, string> = {
  ts: "js.png",
  tsx: "js.png",
  js: "js.png",
  jsx: "js.png",
  mjs: "js.png",
  cjs: "js.png",
  py: "py.png",
  pyw: "py.png",
  c: "c.png",
  h: "c.png",
  cpp: "c++.png",
  cc: "c++.png",
  cxx: "c++.png",
  hpp: "c++.png",
  cs: "c#.png",
  css: "css.png",
  scss: "css.png",
  less: "css.png",
  html: "html.png",
  htm: "html.png",
  php: "php.png",
  ps1: "ps1.png",
  psm1: "ps1.png",
  png: "image.png",
  jpg: "image.png",
  jpeg: "image.png",
  gif: "image.png",
  webp: "image.png",
  bmp: "image.png",
  svg: "image.png",
  ico: "image.png",
};

function CheckIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ background: "var(--green)", color: "var(--bg)", borderRadius: "50%", padding: "2px" }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function FailIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8" r="6.5" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" />
    </svg>
  );
}

function SpinIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
      className="tool__spinner"
    >
      <circle cx="8" cy="8" r="6.5" opacity="0.25" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" strokeLinecap="round" />
    </svg>
  );
}

function ToolBlock({ item }: { item: HistoryItem }): React.ReactElement {
  const { verb, file, suffix } = describe(item);
  const [open, setOpen] = useState(false);
  const stateCls =
    item.ok === undefined
      ? "tool--pending"
      : item.ok
        ? "tool--ok"
        : "tool--err";

  const diff = useMemo(() => computeDiff(item), [item.toolName, item.toolArgs]);
  const hasDiff = diff !== null;

  return (
    <div className={`tool ${stateCls}${hasDiff ? " tool--has-diff" : ""}`}>
      <span className="tool__icon">
        {item.ok === undefined ? (
          <SpinIcon />
        ) : item.ok ? (
          <CheckIcon />
        ) : (
          <FailIcon />
        )}
      </span>
      <span className="tool__line">
        <span className="tool__verb">{verb}</span>
        {file ? (
          <>
            {" "}
            <FileBadge info={file} />
          </>
        ) : null}
        {hasDiff && (
          <span className="tool__diff-stats">
            <span className="tool__diff-add">+{diff.added}</span>
            <span className="tool__diff-remove">-{diff.removed}</span>
          </span>
        )}
        {hasDiff && (
          <button
            className="tool__chevron"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Collapse diff" : "Expand diff"}
          >
            <ChevronRightIcon open={open} />
          </button>
        )}
        {suffix ? <span className="tool__suffix"> {suffix}</span> : null}
      </span>
      {hasDiff && open && (
        <div className="tool__diff-block">
          <div className="tool__diff-header">
            <span className="tool__diff-header-left">
              <img className="ftree__img" src={file ? `icons/symbols/files/${file.ext ? ICON_MAP_HISTORY[file.ext] ?? "document.svg" : "document.svg"}` : "icons/symbols/files/document.svg"} alt="" draggable={false} style={{ width: 16, height: 16 }} />
              <span className="tool__diff-fname">{file?.name}</span>
            </span>
            <span className="tool__diff-header-right">
              <span className="tool__diff-add">+{diff.added}</span>
              <span className="tool__diff-remove">-{diff.removed}</span>
            </span>
          </div>
              <div className="tool__diff-body">
                {diff.lines.map((line, i) => (
                  <div key={i} className={`tool__diff-line tool__diff-line--${line.type}`}>
                    <span className="tool__diff-gutter">
                      {line.type === "add" ? "+" : line.type === "remove" ? "−" : ""}
                    </span>
                    <span className="tool__diff-text">{line.text}</span>
                  </div>
                ))}
              </div>
        </div>
      )}
    </div>
  );
}

interface Props {
  items: HistoryItem[];
  onPickModel?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  streamingId?: string | null;
  busy?: boolean;
}

function DiffIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="3" y1="9" x2="9" y2="9" />
      <line x1="3" y1="15" x2="9" y2="15" />
    </svg>
  );
}

function CircularProgress({ percent }: { percent: number }): React.ReactElement {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width="16" height="16" viewBox="0 0 20 20" style={{ transform: "rotate(-90deg)" }}>
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="currentColor"
        strokeWidth="2"
        fill="transparent"
        opacity="0.2"
      />
      <circle
        cx="10"
        cy="10"
        r={radius}
        stroke="currentColor"
        strokeWidth="2"
        fill="transparent"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ open }: { open?: boolean }): React.ReactElement {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function LikeIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function DislikeIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}

function MessageFooter({
  item,
  items,
  onRegenerate,
}: {
  item: HistoryItem;
  items: HistoryItem[];
  onRegenerate?: (id: string) => void;
}): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const hasDiff = React.useMemo(() => {
    // Find index of this item
    const idx = items.findIndex((it) => it.id === item.id);
    if (idx <= 0) return false;
    // Look at items between this assistant message and the previous user message
    for (let i = idx - 1; i >= 0; i--) {
      const it = items[i]!;
      if (it.kind === "user") break;
      if (it.kind === "tool" && (it.toolName === "edit_file" || it.toolName === "write_file")) {
        return true;
      }
    }
    return false;
  }, [item.id, items]);

  const contextUsage = React.useMemo(() => {
    // Heuristic: count total characters in history as a proxy for tokens
    const totalChars = items.reduce((acc, it) => acc + it.text.length, 0);
    // Assume 128k context (common for GPT-4o) and ~4 chars per token
    const estimatedTokens = totalChars / 4;
    const maxTokens = 128000;
    const percent = Math.min(100, Math.max(1, Math.round((estimatedTokens / maxTokens) * 100)));
    return percent;
  }, [items]);

  const onCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="msg__footer">
      <div className="msg__separator" />
      <div className="msg__footer-content">
        <div className="msg__footer-left">
          <div className="msg__footer-item msg__footer-item--green">
            <CheckIcon />
            <span>Completed</span>
          </div>
          <span className="msg__footer-sep">|</span>
          {hasDiff && (
            <>
              <div className="msg__footer-item">
                <DiffIcon />
                <span>Diff</span>
              </div>
              <span className="msg__footer-sep">|</span>
            </>
          )}
          <div className="msg__footer-item">
            <div className="context-usage">
              <CircularProgress percent={contextUsage} />
              <span>{contextUsage}%</span>
            </div>
          </div>
        </div>
        <div className="msg__footer-right">
          <button className="msg__footer-btn" onClick={onCopy} title="Copy">
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
          <button
            className="msg__footer-btn"
            onClick={() => onRegenerate?.(item.id)}
            title="Regenerate"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

const VIBE_PHRASES = [
  "Vibing...",
  "Catching the flow...",
  "Brewing code...",
  "Feeling the logic...",
  "Chilling with the bits...",
  "Surfing the syntax...",

];

function VibingLoader({ text, isInline }: { text?: string; isInline?: boolean }): React.ReactElement {
  const phrase = React.useMemo(() => {
    if (text !== undefined) return text;
    return VIBE_PHRASES[Math.floor(Math.random() * VIBE_PHRASES.length)];
  }, [text]);

  return (
    <div className={`msg--thinking ${isInline ? "msg--thinking--inline" : ""}`}>
      <div className="loader">
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
        <span className="loader__dot" />
      </div>
      {phrase && <span className="msg--thinking__text">{phrase}</span>}
    </div>
  );
}

export function History({ items, onPickModel, onRegenerate, streamingId, busy }: Props): React.ReactElement {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // auto-scroll only if user is already near the bottom
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [items, busy]);

  return (
    <div className="history" ref={ref}>
      {items.map((item) => {
        if (item.kind === "tool") return <ToolBlock key={item.id} item={item} />;
        if (item.kind === "model-picker" && item.models) {
          return (
            <div key={item.id} className="modelpicker">
              <div className="modelpicker__title">Select a model:</div>
              {item.models.map((m) => (
                <button
                  key={m.id}
                  className={
                    "modelpicker__item" +
                    (m.id === item.currentModel ? " modelpicker__item--active" : "")
                  }
                  onClick={() => onPickModel?.(m.id)}
                >
                  <span className="modelpicker__name">{m.name}</span>
                  <span className="modelpicker__id">{m.id}</span>
                  <span className="modelpicker__check">✓</span>
                </button>
              ))}
            </div>
          );
        }
        if (item.kind === "user") {
          return (
            <div key={item.id} className="msg msg--user-wrap">
              <div className="msg msg--user">{item.text}</div>
              {item.attachments && item.attachments.length > 0 ? (
                <div className="msg__attachments">
                  {item.attachments.map((a) =>
                    a.kind === "image" && a.dataUrl ? (
                      <img
                        key={a.id}
                        className="msg__image"
                        src={a.dataUrl}
                        alt={a.name}
                        title={a.name}
                      />
                    ) : (
                      <span
                        key={a.id}
                        className="msg__file"
                        title={a.path ?? a.name}
                      >
                        <span className="msg__file-icon">⌘</span>
                        {a.name}
                      </span>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          );
        }
        const cls = `msg msg--${item.kind}`;
        const isStreaming = item.kind === "assistant" && item.id === streamingId;

        if (item.kind === "stopped") {
          return (
            <div key={item.id} className="msg msg--info msg--stopped">
              <div className="msg--stopped-line" />
              <span className="msg--stopped-text">{t("manuallyStopped")}</span>
              <div className="msg--stopped-line" />
            </div>
          );
        }

        return (
          <div key={item.id} className={cls}>
            {item.text}
            {isStreaming && (
              <VibingLoader text={item.text.length > 0 ? "" : undefined} isInline={item.text.length > 0} />
            )}
            {item.kind === "assistant" && !isStreaming && item.text.length > 0 && (
              <MessageFooter item={item} items={items} onRegenerate={onRegenerate} />
            )}
          </div>
        );
      })}

      {busy && !streamingId && !items.some(it => it.kind === "tool" && it.ok === undefined) && (
        <VibingLoader />
      )}
    </div>
  );
}
