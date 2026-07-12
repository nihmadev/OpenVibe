import React from "react";
import { HistoryItem } from "../chat-history/types.js";
import { describe, pickFile } from "../chat-history/utils.js";
import { FailIcon } from "../chat-history/ChatHistoryIcons.js";
import { FileBadge } from "../chat-history/ChatHistorySubComponents.js";
import { ChevronRightIcon, Loader2Icon } from "../icons/ui-icons.js";
import { FileIcon } from "../icons/file-icons.js";
import { useI18n } from "../../hooks/useI18n.js";
import { CodeBlock, resolveMonacoLang } from "../CodeBlock/CodeBlock.js";
import { DiffEditor } from "../DiffEditor/DiffEditor.js";
import "../../styles/Tool.css";

// ─── Animated counter ─────────────────────────────────────────────────────

function AnimatedValue({ value, prefix }: { value: number; prefix: string }) {
  const [display, setDisplay] = React.useState(value);
  const raf = React.useRef<number>(0);

  React.useEffect(() => {
    const from = display;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 180;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };

    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <>
      {prefix}
      {display}
    </>
  );
}

// ─── Streaming code helper ────────────────────────────────────────────────

function StreamingCodeBlock({ toolStream, toolName }: { toolStream: string; toolName?: string }) {
  const det = React.useMemo(() => {
    try {
      const parsed = JSON.parse(toolStream);
      const content =
        toolName === "edit_file"
          ? parsed.new_str
          : toolName === "write_file"
            ? parsed.content
            : toolName === "bash"
              ? parsed.command
              : null;
      if (typeof content !== "string") return null;
      const path = typeof parsed.path === "string" ? parsed.path : "";
      const info = path ? pickFile({ path }) : null;
      const lang =
        info?.ext || (toolName === "bash" ? "sh" : toolName?.startsWith("edit") ? "typescript" : "plaintext");
      return { content, lang };
    } catch {
      /* JSON parse error */
    }
    return null;
  }, [toolStream, toolName]);

  if (!det) return null;

  return (
    <div className="code-block">
      <div className="code-block__body">
        <pre className="code-block__pre">
          <code className="code-block__code">{det.content}</code>
        </pre>
      </div>
    </div>
  );
}

function DiffBlock({ item, file }: { item: HistoryItem; file?: { name: string } | null }) {
  const [diffData, setDiffData] = React.useState<{ original: string; modified: string; lang: string } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (item.ok !== true) {
      setLoading(false);
      return;
    }
    const args = item.toolArgs as Record<string, unknown> | undefined;
    const path = typeof args?.path === "string" ? args.path : typeof args?.file === "string" ? args.file : null;
    if (!path) {
      setLoading(false);
      return;
    }
    window.vibe.fs.read(path).then((r) => {
      if (r.ok) {
        const modified = r.content;
        const oldStr = typeof args?.old_str === "string" ? args.old_str : "";
        const newStr = typeof args?.new_str === "string" ? args.new_str : "";
        const pos = newStr ? modified.indexOf(newStr) : -1;
        let original = modified;
        if (pos !== -1 && oldStr) {
          original = modified.slice(0, pos) + oldStr + modified.slice(pos + newStr.length);
        }
        const info = pickFile(args);
        const lang = resolveMonacoLang(info?.ext || "plaintext");
        setDiffData({ original, modified, lang });
      }
      setLoading(false);
    });
  }, [item.id, item.ok, item.toolArgs]);

  return (
    <>
      <div className="tool__diff-header">
        <span className="tool__diff-header-left">
          <FileIcon name={file?.name} />
          <span className="tool__diff-fname">{file?.name}</span>
        </span>
      </div>
      {loading && <div className="tool__diff-loading">Loading diff…</div>}
      {!loading && diffData && (
        <DiffEditor original={diffData.original} modified={diffData.modified} language={diffData.lang} />
      )}
    </>
  );
}

function WriteFileBlock({ item }: { item: HistoryItem }) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (item.ok !== true) {
      setLoading(false);
      return;
    }
    const args = item.toolArgs as Record<string, unknown> | undefined;
    const path = typeof args?.path === "string" ? args.path : null;
    if (!path) {
      setLoading(false);
      return;
    }
    window.vibe.fs.read(path).then((r) => {
      if (r.ok) setContent(r.content);
      setLoading(false);
    });
  }, [item.id, item.ok, item.toolArgs]);

  if (loading) return <div className="tool__diff-loading">Loading…</div>;
  if (!content) return null;
  const info = pickFile(item.toolArgs);
  const lang = resolveMonacoLang(info?.ext || "plaintext");

  return (
    <>
      <div className="tool__diff-header">
        <span className="tool__diff-header-left">
          <FileIcon name={info?.name} />
          <span className="tool__diff-fname">{info?.name}</span>
        </span>
      </div>
      <DiffEditor original="" modified={content} language={lang} />
    </>
  );
}

function getToolResultLang(item: HistoryItem): string {
  if (item.toolName === "bash") return "sh";
  if (item.toolName === "list_dir") return "plaintext";
  if (item.toolName === "read_file") {
    const info = pickFile(item.toolArgs);
    return info?.ext || "plaintext";
  }
  return "plaintext";
}

export function AgentToolView({
  item,
  onDrillDown,
  cwd,
}: {
  item: HistoryItem;
  onDrillDown?: (id: string) => void;
  cwd?: string;
}) {
  const { t } = useI18n();
  const { verb, file, suffix } = describe(item, t, cwd);
  const isPending = item.ok === undefined;
  const isErr = item.ok === false;
  const isStreaming = isPending && !!item.toolStream;
  const isListDir = item.toolName === "list_dir";
  const isSearchCodebase = item.toolName === "search_codebase";
  const isAgent = item.toolName === "agent";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (isStreaming) setOpen(true);
  }, [isStreaming]);

  const diffInfo = React.useMemo(() => {
    if (item.toolName !== "edit_file" && item.toolName !== "write_file") return null;
    const args = item.toolArgs as Record<string, unknown> | undefined;
    if (!args) return null;
    if (item.toolName === "edit_file") {
      const oldStr = String(args.old_str ?? "");
      const newStr = String(args.new_str ?? "");
      return { added: newStr.split("\n").filter(Boolean).length, removed: oldStr.split("\n").filter(Boolean).length };
    }
    if (item.toolName === "write_file") {
      const content = String(args.content ?? "");
      return { added: content.split("\n").filter(Boolean).length, removed: 0 };
    }
    return null;
  }, [item.toolName, item.toolArgs]);

  if (isAgent) {
    return (
      <div
        className={`tool tool--agent ${isPending ? "tool--pending" : isErr ? "tool--err" : "tool--ok"}`}
        role="button"
        tabIndex={0}
        onClick={() => onDrillDown?.(item.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDrillDown?.(item.id);
          }
        }}
      >
        <span className="tool__icon">{isPending ? <Loader2Icon /> : null}</span>
        <span className="tool__line">
          <span className="tool__verb">{verb}</span>
          <span className="tool__agent-task">{suffix}</span>
        </span>
      </div>
    );
  }

  const hasResultText = item.ok === true && !!item.text;
  const stateCls = isStreaming ? "tool--streaming" : isPending ? "tool--pending" : isErr ? "tool--err" : "tool--ok";
  const isReadFile = item.toolName === "read_file";
  const hasExpandable =
    (diffInfo !== null || hasResultText || isStreaming) && !isListDir && !isSearchCodebase && !isReadFile;

  return (
    <div className={`tool ${stateCls}${hasExpandable ? " tool--has-diff" : ""}`}>
      {isErr && (
        <span className="tool__icon">
          <FailIcon />
        </span>
      )}
      <span className="tool__line">
        <span className="tool__verb">{verb}</span>
        {file ? (
          <>
            {" "}
            <FileBadge info={file} />
          </>
        ) : null}
        {hasExpandable && (
          <>
            {diffInfo && (
              <span className="tool__diff-stats">
                <span className="tool__diff-add">
                  <AnimatedValue value={diffInfo.added} prefix="+" />
                </span>
                <span className="tool__diff-remove">
                  <AnimatedValue value={diffInfo.removed} prefix="−" />
                </span>
              </span>
            )}
            {!isListDir && (
              <button
                className="tool__chevron"
                onClick={() => setOpen(!open)}
                aria-label={open ? "Collapse" : "Expand"}
              >
                <ChevronRightIcon open={open} />
              </button>
            )}
          </>
        )}
        {suffix ? <span className="tool__suffix"> {suffix}</span> : null}
      </span>
      {hasExpandable && (
        <div className={`tool__diff-block${open ? "" : " tool__diff-block--hidden"}`}>
          {isStreaming && item.toolStream ? (
            <StreamingCodeBlock toolStream={item.toolStream} toolName={item.toolName} />
          ) : item.toolName === "edit_file" ? (
            <DiffBlock item={item} file={file} />
          ) : item.toolName === "write_file" ? (
            <WriteFileBlock item={item} />
          ) : (
            <CodeBlock language={getToolResultLang(item)} code={item.text} />
          )}
        </div>
      )}
    </div>
  );
}
