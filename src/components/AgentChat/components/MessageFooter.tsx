import React, { useEffect, useState, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useI18n } from "../../../hooks/useI18n.js";
import { CheckCircleIcon, DiffIcon, CircularProgress, ChevronRightIcon } from "../../Icons/icons.js";
import { FileIcon } from "../../Icons/file-icons.js";
import { Tooltip } from "../../Tooltip/Tooltip.js";
import { DiffEditor } from "../../DiffEditor/DiffEditor.js";
import { resolveMonacoLang } from "../../CodeBlock/CodeBlock.js";
import { pickFile, toRelativePath } from "../utils.js";
import type { HistoryItem } from "../types.js";
import { ContextMenu } from "../../ContextMenu/ContextMenu.js";
import { writeClipboard } from "../../../utils/clipboard.js";

interface FileChangeInfo {
  filePath: string;
  added: number;
  removed: number;
  item: HistoryItem;
}

function getFileChanges(items: HistoryItem[], currentId: string): FileChangeInfo[] {
  const idx = items.findIndex((it) => it.id === currentId);
  if (idx <= 0) return [];

  const result: FileChangeInfo[] = [];
  for (let i = idx - 1; i >= 0; i--) {
    const it = items[i]!;
    if (it.kind === "user") break;
    if (it.kind !== "tool" || it.ok !== true) continue;
    if (it.toolName === "edit_file") {
      const args = it.toolArgs as Record<string, unknown> | undefined;
      if (!args?.path) continue;
      const oldStr = String(args.old_str ?? "");
      const newStr = String(args.new_str ?? "");
      result.push({
        filePath: String(args.path),
        added: newStr.split("\n").filter(Boolean).length,
        removed: oldStr.split("\n").filter(Boolean).length,
        item: it,
      });
    } else if (it.toolName === "write_file") {
      const args = it.toolArgs as Record<string, unknown> | undefined;
      if (!args?.path) continue;
      const content = String(args.content ?? "");
      result.push({
        filePath: String(args.path),
        added: content.split("\n").filter(Boolean).length,
        removed: 0,
        item: it,
      });
    }
  }
  return result.reverse();
}

function FileChangeRow({ change, cwd }: { change: FileChangeInfo; cwd?: string }) {
  const [open, setOpen] = useState(false);
  const [diffData, setDiffData] = useState<{ original: string; modified: string; lang: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const relPath = toRelativePath(change.filePath, cwd);
  const info = pickFile(change.item.toolArgs);

  useEffect(() => {
    if (!open) return;
    if (diffData !== null) return;
    setLoading(true);

    if (change.item.toolName === "edit_file") {
      window.vibe.fs.read(change.filePath).then((r) => {
        if (r.ok) {
          const args = change.item.toolArgs as Record<string, unknown>;
          const modified = r.content;
          const oldStr = typeof args.old_str === "string" ? args.old_str : "";
          const newStr = typeof args.new_str === "string" ? args.new_str : "";
          const pos = newStr ? modified.indexOf(newStr) : -1;
          let original = modified;
          if (pos !== -1 && oldStr) {
            original = modified.slice(0, pos) + oldStr + modified.slice(pos + newStr.length);
          }
          const lang = resolveMonacoLang(info?.ext || "plaintext");
          setDiffData({ original, modified, lang });
        }
        setLoading(false);
      });
    } else if (change.item.toolName === "write_file") {
      window.vibe.fs.read(change.filePath).then((r) => {
        if (r.ok) {
          const lang = resolveMonacoLang(info?.ext || "plaintext");
          setDiffData({ original: "", modified: r.content, lang });
        }
        setLoading(false);
      });
    }
  }, [open, change.filePath, change.item.toolName, change.item.toolArgs, diffData, info?.ext]);

  return (
    <div className="changes-pill">
      <div
        className={`changes-pill__bar${open ? " changes-pill__bar--open" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="changes-pill__icon">
          <FileIcon name={relPath} />
        </span>
        <span className="changes-pill__path">{relPath}</span>
        <span className="changes-pill__stats">
          <span className="tool__diff-add">+{change.added}</span>
          <span className="tool__diff-remove">−{change.removed}</span>
        </span>
        <span className="changes-pill__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </div>
      <div className={`changes-pill__diff${open ? "" : " changes-pill__diff--hidden"}`}>
        {loading && <div className="tool__diff-loading">Loading diff…</div>}
        {!loading && diffData && (
          <DiffEditor original={diffData.original} modified={diffData.modified} language={diffData.lang} />
        )}
      </div>
    </div>
  );
}

function FileChangesSummary({ items, currentId, cwd }: { items: HistoryItem[]; currentId: string; cwd?: string }) {
  const { t } = useI18n();
  const changes = useMemo(() => getFileChanges(items, currentId), [items, currentId]);

  if (changes.length === 0) return null;

  const totalAdded = changes.reduce((sum, c) => sum + c.added, 0);
  const totalRemoved = changes.reduce((sum, c) => sum + c.removed, 0);

  return (
    <div className="changes-summary">
      <div className="changes-summary__header">
        <span>{t("filesChanged", { count: changes.length })}</span>
        <span className="changes-summary__total">
          <span className="tool__diff-add">+{totalAdded}</span>
          <span className="tool__diff-remove">−{totalRemoved}</span>
        </span>
      </div>
      <div className="changes-table">
        {changes.map((change) => (
          <FileChangeRow key={change.item.id} change={change} cwd={cwd} />
        ))}
      </div>
    </div>
  );
}

/** Keep the normal copy action readable while Raw preserves the exact model output. */
function toPlainText(markdown: string): string {
  return markdown
    .replace(/^\s*```[^\n]*\n/gm, "")
    .replace(/^\s*```\s*$/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1");
}

function formatRawTrace(items: HistoryItem[]): string {
  return items
    .filter((entry) => entry.kind !== "user")
    .map((entry) => {
      if (entry.kind === "tool") {
        const args = entry.toolArgs ?? (entry.toolStream ? entry.toolStream : undefined);
        const argsText = typeof args === "string" ? args : JSON.stringify(args ?? {}, null, 2);
        return [
          `## Tool call: ${entry.toolName ?? "unknown"}`,
          `id: ${entry.id}`,
          `status: ${entry.ok === false ? "failed" : entry.ok === true ? "ok" : "pending"}`,
          "arguments:",
          "```json",
          argsText,
          "```",
          entry.text ? "result:" : "result: (empty)",
          entry.text || "",
        ].join("\n");
      }

      if (entry.kind === "assistant") {
        const sections = [`## Assistant message: ${entry.id}`];
        if (entry.reasoningName) sections.push(`reasoning name: ${entry.reasoningName}`);
        if (entry.reasoning) sections.push("<thinking>\n" + entry.reasoning + "\n</thinking>");
        if (entry.text) sections.push(entry.text);
        return sections.join("\n\n");
      }

      return `## ${entry.kind}\n${entry.text}`;
    })
    .join("\n\n---\n\n");
}

export function MessageFooter({
  item,
  items,
  runItems,
  onRegenerate,
  cwd,
}: {
  item: HistoryItem;
  items: HistoryItem[];
  runItems: HistoryItem[];
  onRegenerate?: (id: string) => void;
  cwd?: string;
}): React.ReactElement {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [copyMenu, setCopyMenu] = useState<{ x: number; y: number } | null>(null);
  const hasDiff = useMemo(() => {
    const idx = items.findIndex((it) => it.id === item.id);
    if (idx <= 0) return false;
    for (let i = idx - 1; i >= 0; i--) {
      const it = items[i]!;
      if (it.kind === "user") break;
      if (it.kind === "tool" && (it.toolName === "edit_file" || it.toolName === "write_file")) {
        return true;
      }
    }
    return false;
  }, [item.id, items]);

  const [contextUsage, setContextUsage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    invoke<{ usedTokens: number; maxTokens: number; percent: number }>("estimate_context_tokens")
      .then((result) => {
        if (!cancelled) setContextUsage(result.percent);
      })
      .catch(() => {
        if (!cancelled) setContextUsage(1);
      });
    return () => {
      cancelled = true;
    };
  }, [items]);

  const copyText = async (text: string) => {
    const ok = await writeClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openCopyMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setCopyMenu({ x: rect.right - 4, y: rect.bottom + 4 });
  };

  return (
    <div className="msg__footer">
      <div className="msg__separator" />
      <FileChangesSummary items={items} currentId={item.id} cwd={cwd} />
      <div className="msg__footer-content">
        <div className="msg__footer-left">
          <div className="msg__footer-item msg__footer-item--green">
            <CheckCircleIcon />
            <span>{t("completed")}</span>
          </div>
          <span className="msg__footer-sep">|</span>
          {hasDiff && (
            <>
              <div className="msg__footer-item">
                <DiffIcon />
                <span>{t("diff")}</span>
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
          <Tooltip text={t("copy")}>
            <button
              className="msg__footer-btn"
              onClick={openCopyMenu}
              aria-label={t("copy")}
              aria-haspopup="menu"
              aria-expanded={copyMenu !== null}
            >
              {copied ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--green)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              )}
            </button>
          </Tooltip>
          <Tooltip text={t("regenerate")}>
            <button className="msg__footer-btn" onClick={() => onRegenerate?.(item.id)}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </Tooltip>
        </div>
      </div>
      {copyMenu && (
        <ContextMenu
          x={copyMenu.x}
          y={copyMenu.y}
          onClose={() => setCopyMenu(null)}
          items={[
            { label: t("copyFormatted"), onClick: () => copyText(toPlainText(item.text)) },
            { label: t("copyRaw"), onClick: () => copyText(formatRawTrace(runItems)) },
          ]}
        />
      )}
    </div>
  );
}
