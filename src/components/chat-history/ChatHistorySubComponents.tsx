import React from "react";
import { HistoryItem } from "./types";
import { FileBadgeInfo, describe, pickFile, toRelativePath } from "./utils.js";
import { useI18n } from "../../hooks/useI18n.js";
import { CheckCircleIcon, FailIcon, SpinIcon, DiffIcon, CircularProgress } from "../icons/icons.js";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRightIcon } from "../icons/icons.js";
import { FileIcon, FolderIcon } from "../icons/file-icons.js";
import { Markdown } from "../Markdown/Markdown.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { AgentToolView } from "../AgentToolView/AgentToolView.js";
import { DiffEditor } from "../DiffEditor/DiffEditor.js";
import { resolveMonacoLang } from "../CodeBlock/CodeBlock.js";

export function FileBadge({ info }: { info: FileBadgeInfo }): React.ReactElement {
  const display = info.rawPath ?? info.name;
  return (
    <span className="fbadge">
      {info.cls === "dir" ? <FolderIcon open={false} name={info.name} /> : <FileIcon name={info.name} />}
      <span className="fbadge__name">{display}</span>
    </span>
  );
}

export function UserMessageActions({
  item,
  onRevert,
}: {
  item: HistoryItem;
  onRevert?: (id: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const [copied, setCopied] = React.useState(false);

  const onCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="msg--user-actions">
      <Tooltip text={t("revertToMessage")}>
        <button className="msg__action-btn" onClick={() => onRevert?.(item.id)}>
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
            <polyline points="9 10 4 15 9 20"></polyline>
            <path d="M20 4v7a4 4 0 0 1-4 4H4"></path>
          </svg>
        </button>
      </Tooltip>
      <Tooltip text={t("copy")}>
        <button className="msg__action-btn" onClick={onCopy}>
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
    </div>
  );
}

export function ToolBlock({ item }: { item: HistoryItem }): React.ReactElement {
  const { t } = useI18n();
  const { verb, file, suffix } = describe(item, t);
  const stateCls = item.ok === undefined ? "tool--pending" : item.ok ? "tool--ok" : "tool--err";

  return (
    <div className={`tool ${stateCls}`}>
      <span className="tool__icon">
        {item.ok === undefined ? <SpinIcon /> : item.ok ? <CheckCircleIcon /> : <FailIcon />}
      </span>
      <span className="tool__line">
        <span className="tool__verb">{verb}</span>
        {file ? (
          <>
            {" "}
            <FileBadge info={file} />
          </>
        ) : null}
        {suffix ? <span className="tool__suffix"> {suffix}</span> : null}
      </span>
    </div>
  );
}

export function ToolGroup({ items, cwd }: { items: HistoryItem[]; cwd?: string }): React.ReactElement {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);

  const counts = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const name = item.toolName ?? "tool";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const isAnalysisGroup = React.useMemo(() => {
    const analysisTools = new Set(["read_file", "search_codebase", "list_dir", "agent"]);
    return items.every((item) => analysisTools.has(item.toolName ?? ""));
  }, [items]);

  const toolNameToKey: Record<string, string> = {
    read_file: "analysisRead",
    search_codebase: "analysisSearch",
    write_file: "analysisWrite",
    edit_file: "analysisEdit",
    bash: "analysisBash",
    list_dir: "analysisList",
    agent: "analysisAgent",
  };

  const hasPending = items.some((item) => item.ok === undefined);

  const pluralizeCount = (count: number, keyBase: string): string => {
    const mod10 = count % 10;
    const mod100 = count % 100;
    let suffix: string;
    if (mod10 === 1 && mod100 !== 11) {
      suffix = t(`${keyBase}_one`);
    } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
      suffix = t(`${keyBase}_few`);
    } else {
      suffix = t(keyBase);
    }
    return `${count} ${suffix}`;
  };

  const parts: string[] = [];
  for (const [name, count] of counts) {
    const keyBase = toolNameToKey[name] ?? name;
    parts.push(pluralizeCount(count, keyBase));
  }
  const summary = parts.join(", ");

  return (
    <div className="tool-group">
      <div
        className="tool-group__header"
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
        <span className={`tool-group__label${hasPending ? " tool-group__label--pending" : ""}`}>
          {isAnalysisGroup ? t("analysis") : t("changes")}
        </span>
        <span className="tool-group__summary">{summary}</span>
        <span className="tool-group__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </div>
      <div className={`tool-group__tools${open ? "" : " tool-group__tools--hidden"}`}>
        {items.map((item) => (
          <AgentToolView key={item.id} item={item} cwd={cwd} />
        ))}
      </div>
    </div>
  );
}

export function MessageFooter({
  item,
  items,
  onRegenerate,
  cwd,
}: {
  item: HistoryItem;
  items: HistoryItem[];
  onRegenerate?: (id: string) => void;
  cwd?: string;
}): React.ReactElement {
  const { t } = useI18n();
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

  const [contextUsage, setContextUsage] = React.useState(1);

  React.useEffect(() => {
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

  const onCopy = () => {
    navigator.clipboard.writeText(item.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
            <button className="msg__footer-btn" onClick={onCopy}>
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
    </div>
  );
}

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
  const [open, setOpen] = React.useState(false);
  const [diffData, setDiffData] = React.useState<{ original: string; modified: string; lang: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const relPath = toRelativePath(change.filePath, cwd);
  const info = pickFile(change.item.toolArgs);

  React.useEffect(() => {
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

function pluralFilesChanged(n: number, t: (key: string) => string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `1 ${t("filesChanged_one")}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} ${t("filesChanged_few")}`;
  return `${n} ${t("filesChanged")}`;
}

function FileChangesSummary({ items, currentId, cwd }: { items: HistoryItem[]; currentId: string; cwd?: string }) {
  const { t } = useI18n();
  const changes = React.useMemo(() => getFileChanges(items, currentId), [items, currentId]);

  if (changes.length === 0) return null;

  const totalAdded = changes.reduce((sum, c) => sum + c.added, 0);
  const totalRemoved = changes.reduce((sum, c) => sum + c.removed, 0);

  return (
    <div className="changes-summary">
      <div className="changes-summary__header">
        <span>{pluralFilesChanged(changes.length, t)}</span>
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

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);

  React.useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function ThinkingBlock({
  reasoning,
  reasoningDone,
}: {
  reasoning: string;
  reasoningDone?: boolean;
}): React.ReactElement {
  // Debounce during active streaming to batch rapid chunks and avoid flickering.
  // When reasoningDone, flush immediately.
  const displayReasoning = useDebouncedValue(reasoning, reasoningDone ? 0 : 50);

  return (
    <div className="thinking-block">
      <div className="thinking-content">
        <Markdown content={displayReasoning} isAssistant={true} simplifiedCodeBlocks={true} noFileIcons={true} />
      </div>
    </div>
  );
}

export function VibingLoader({ text }: { text?: string }): React.ReactElement {
  const { t } = useI18n();
  const phrases = [
    t("vibing"),
    t("catchingFlow"),
    t("brewingCode"),
    t("feelingLogic"),
    t("chillingBits"),
    t("surfingSyntax"),
  ];
  const phrase = React.useMemo(() => {
    if (text !== undefined) return text;
    return phrases[Math.floor(Math.random() * phrases.length)];
  }, [text, phrases]);

  return (
    <div className="msg--thinking">
      <div className="loader">
        {[...Array(9)].map((_, i) => (
          <span key={i} className="loader__dot" />
        ))}
      </div>
      {phrase && <span className="msg--thinking__text">{phrase}</span>}
    </div>
  );
}
