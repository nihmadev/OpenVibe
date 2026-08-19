import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React from "react";
import { FileIcon, FolderIcon } from "@/base/browser/ui/icons/fileIcons";
import { ChevronRightIcon, ShowMoreIcon, ToolGlyph } from "@/base/browser/ui/icons/iconRegistry";
import { Loader } from "@/base/browser/ui/loader/loader";
import { useI18n } from "@/platform/localization/localizationService";
import { CodeBlock, resolveMonacoLang } from "@/workbench/browser/parts/editor/codeBlock/codeBlock";
import { DiffEditor } from "@/workbench/browser/parts/editor/diffEditor/diffEditor";
import type { HistoryItem } from "@/workbench/common/conversation";
import {
  describe,
  getEditStrings,
  getFilePathFromArgs,
  pickFile,
} from "@/workbench/services/agent/common/agentToolPresentation";
import { FileBadge } from "../agentChat/components/fileBadge";
import { AnimatedSummary } from "./animatedSummary";
import { useToolDisclosure } from "./useToolDisclosure";
import { useToolEntrance } from "./useToolEntrance";
import "./tool.css";
import { fileService } from "@/workbench/services/files/tauri/fileService";

// ZCode collapse timing: content slides 300ms with the material-standard curve.
const TOOL_COLLAPSE_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

// ─── Animated counter ─────────────────────────────────────────────────────

function AnimatedValue({ value, prefix }: { value: number; prefix: string }) {
  const [display, setDisplay] = React.useState(value);
  const displayRef = React.useRef(value);
  const raf = React.useRef<number>(0);

  React.useEffect(() => {
    const from = displayRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    const duration = 180;

    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      const next = Math.round(from + (to - from) * eased);
      displayRef.current = next;
      setDisplay(next);
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
      const { newStr } = getEditStrings(parsed);
      const content = newStr || (typeof parsed.command === "string" ? parsed.command : null);
      if (typeof content !== "string") return null;
      const path = getFilePathFromArgs(parsed) || "";
      const info = path ? pickFile({ path }) : null;
      const lang =
        info?.ext || (toolName === "run" || toolName === "bash" || toolName === "run_command" ? "sh" : "typescript");
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
          <code className="code-block__code">{det.content.trimEnd()}</code>
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
    const path = getFilePathFromArgs(item.toolArgs);
    const { oldStr, newStr } = getEditStrings(item.toolArgs);
    const info = pickFile(item.toolArgs) || file;
    const lang = resolveMonacoLang((info as any)?.ext || "plaintext");

    if (path) {
      fileService.read(path).then((r) => {
        if (r.ok) {
          const modified = r.content;
          const pos = newStr ? modified.indexOf(newStr) : -1;
          let original = modified;
          if (pos !== -1 && oldStr) {
            original = modified.slice(0, pos) + oldStr + modified.slice(pos + newStr.length);
          }
          setDiffData({ original, modified, lang });
        } else {
          setDiffData({ original: oldStr, modified: newStr, lang });
        }
        setLoading(false);
      });
    } else if (oldStr || newStr) {
      setDiffData({ original: oldStr, modified: newStr, lang });
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [item.ok, item.toolArgs, file]);

  const info = pickFile(item.toolArgs) || file;

  return (
    <>
      <div className="tool__diff-header">
        <span className="tool__diff-header-left">
          <FileIcon name={info?.name} />
          <span className="tool__diff-fname">{info?.name}</span>
        </span>
      </div>
      {loading && (
        <div className="tool__diff-loading">
          <Loader />
        </div>
      )}
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
    const path = getFilePathFromArgs(item.toolArgs);
    const { newStr } = getEditStrings(item.toolArgs);

    if (path) {
      fileService.read(path).then((r) => {
        if (r.ok) setContent(r.content);
        else if (newStr) setContent(newStr);
        setLoading(false);
      });
    } else {
      if (newStr) setContent(newStr);
      setLoading(false);
    }
  }, [item.ok, item.toolArgs]);

  if (loading)
    return (
      <div className="tool__diff-loading">
        <Loader />
      </div>
    );
  if (!content) return <div className="tool__diff-loading">No content preview available.</div>;
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
  if (item.toolName === "run" || item.toolName === "bash" || item.toolName === "run_command") return "sh";
  if (item.toolName === "read_skill" || item.toolName === "read_skill_resource") return "markdown";
  if (item.toolName === "list_skills") return "json";
  if (item.toolName === "web_search" || item.toolName === "fetch_url") return "markdown";
  if (item.toolName === "list_dir") return "plaintext";
  if (item.toolName === "read_file" || item.toolName === "view_file") {
    const info = pickFile(item.toolArgs);
    return info?.ext || "plaintext";
  }
  return "plaintext";
}

function formatToolResultText(text: string, fallbackLang: string): { code: string; lang: string } {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed);
    return { code: JSON.stringify(parsed, null, 2), lang: "json" };
  } catch {
    /* not JSON */
  }
  return { code: text, lang: fallbackLang };
}

function ListDirBlock({ item }: { item: HistoryItem }) {
  const { t } = useI18n();
  const pageSize = 10;
  const [visibleCount, setVisibleCount] = React.useState(pageSize);
  const content = item.text || "";
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0 || (lines.length === 1 && lines[0] === "(empty)")) {
    return <div className="tool__diff-loading">{t("emptyDirectory")}</div>;
  }

  const visibleLines = lines.slice(0, visibleCount);
  const hasMore = visibleCount < lines.length;

  return (
    <div className="list-dir-block">
      {visibleLines.map((line, i) => {
        const isDir = line.endsWith("/");
        const name = isDir ? line.slice(0, -1) : line;
        return (
          <div key={i} className="list-dir-row" style={{ animationDelay: `${Math.min(i, pageSize - 1) * 24}ms` }}>
            <span className="list-dir-icon">
              {isDir ? <FolderIcon open={false} name={name} /> : <FileIcon name={name} />}
            </span>
            <span className="list-dir-name">{name}</span>
          </div>
        );
      })}
      {hasMore && (
        <button className="list-dir-more" onClick={() => setVisibleCount((count) => count + pageSize)}>
          <ShowMoreIcon />
          {t("showMore")}
        </button>
      )}
    </div>
  );
}

export function AgentToolView({
  item,
  onDrillDown,
  cwd,
  onOpenAgentDiff,
}: {
  item: HistoryItem;
  onDrillDown?: (id: string) => void;
  cwd?: string;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}) {
  const { t } = useI18n();
  const { verb, file, suffix } = describe(item, cwd, t);
  const reducedMotion = useReducedMotion();
  const isPending = item.ok === undefined;
  const isErr = item.ok === false;
  const isStreaming = isPending && !!item.toolStream;
  const isListDir = item.toolName === "list_dir";
  const isSearchCodebase = item.toolName === "search_codebase";
  const isAgent = item.toolName === "agent";
  const isWebTool = item.toolName === "web_search" || item.toolName === "fetch_url";
  // Entrance fade only plays for tools that appear live during a run;
  // restored history (always completed) renders without it.
  const entrance = useToolEntrance(item.id, isPending);
  const changedPath = getFilePathFromArgs(item.toolArgs);
  const canOpenDiff =
    item.ok === true &&
    !!changedPath &&
    (item.toolName === "edit_file" || item.toolName === "write_file") &&
    !!onOpenAgentDiff;

  const diffInfo = React.useMemo(() => {
    const editTools = new Set([
      "edit_file",
      "replace_file_content",
      "multi_replace_file_content",
      "write_file",
      "write_to_file",
    ]);
    if (!editTools.has(item.toolName ?? "")) return null;
    const { oldStr, newStr } = getEditStrings(item.toolArgs);
    if (!oldStr && !newStr) return null;
    const added = newStr.split("\n").filter(Boolean).length;
    const removed = oldStr.split("\n").filter(Boolean).length;
    return { added, removed };
  }, [item.toolName, item.toolArgs]);

  const mcpFormatted = React.useMemo(() => {
    if (!item.text) return null;
    return formatToolResultText(item.text, getToolResultLang(item));
  }, [item]);

  const { open, toggle } = useToolDisclosure(item.id, {
    isRunning: isPending,
    autoOpen: isStreaming,
    autoCollapseOnComplete: true,
    defaultOpen: isWebTool,
  });

  if (isAgent) {
    return (
      <div
        className={`tool tool--agent ${isPending ? "tool--pending" : isErr ? "tool--err" : "tool--ok"}`}
        data-tool-stream-animate={entrance ? "true" : undefined}
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
        <span className="tool__icon">
          <ToolGlyph name={item.toolName} state={isPending ? "pending" : isErr ? "error" : "ok"} />
        </span>
        <span className="tool__line">
          <span className="tool__agent-task">{suffix || verb}</span>
          <span className="tool__agent-open">
            <ChevronRightIcon />
          </span>
        </span>
      </div>
    );
  }

  const isMcp = item.toolName?.startsWith("mcp__");
  const hasResultText = item.ok === true && !!item.text;
  const stateCls = isStreaming ? "tool--streaming" : isPending ? "tool--pending" : isErr ? "tool--err" : "tool--ok";
  const isReadFile = item.toolName === "read_file";
  const isGitTool = item.toolName?.startsWith("git_") === true;
  const isTerminalTool = item.toolName === "run" || item.toolName === "bash" || item.toolName === "run_command";
  const isSkillTool =
    item.toolName === "list_skills" || item.toolName === "read_skill" || item.toolName === "read_skill_resource";
  const isWholeRowTrigger = isTerminalTool || isSkillTool;
  const hasExpandable =
    (diffInfo !== null || hasResultText || isStreaming) && !isSearchCodebase && !isReadFile && !isGitTool && !isWebTool;
  const summaryKey = `${verb}|${file?.rawPath ?? file?.name ?? ""}|${suffix}`;

  const icon = (
    <span className={`tool__icon${isPending && (isWebTool || isSkillTool) ? " tool__icon--shimmer" : ""}`}>
      <ToolGlyph name={item.toolName} state={isPending ? "pending" : isErr ? "error" : "ok"} />
    </span>
  );
  const line = (
    <span className="tool__line">
      <AnimatedSummary
        contentKey={summaryKey}
        enabled={!open}
        primary={
          <>
            <span className="tool__verb">{verb}</span>
            {file ? (
              <FileBadge info={file} onClick={canOpenDiff ? () => onOpenAgentDiff(item.id, changedPath) : undefined} />
            ) : null}
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
          </>
        }
        secondary={
          suffix ? (
            <span className={suffix.startsWith("#L") ? "tool__lines" : "tool__suffix"} title={suffix}>
              {suffix}
            </span>
          ) : undefined
        }
      />
      {hasExpandable &&
        (isWholeRowTrigger ? (
          <span className="tool__chevron" aria-hidden="true">
            <ChevronRightIcon open={open} />
          </span>
        ) : (
          <button type="button" className="tool__chevron" onClick={toggle} aria-label={open ? "Collapse" : "Expand"}>
            <ChevronRightIcon open={open} />
          </button>
        ))}
    </span>
  );

  return (
    <div
      className={`tool ${isMcp ? "tool--mcp" : ""} ${stateCls}${hasExpandable ? " tool--has-diff" : ""}`}
      data-tool-stream-animate={entrance ? "true" : undefined}
    >
      {isWholeRowTrigger && hasExpandable ? (
        <button
          type="button"
          className="tool__row-trigger"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? t("showLess") : t("showMore")}
        >
          {icon}
          {line}
        </button>
      ) : (
        <>
          {icon}
          {line}
        </>
      )}
      <AnimatePresence initial={false}>
        {hasExpandable && open && (
          <motion.div
            className="tool__diff-anim"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : TOOL_COLLAPSE_TRANSITION}
          >
            <div className={`tool__diff-block${isListDir ? " tool__diff-block--list" : ""}`}>
              {isStreaming && item.toolStream ? (
                <StreamingCodeBlock toolStream={item.toolStream} toolName={item.toolName} />
              ) : item.toolName === "edit_file" ||
                item.toolName === "replace_file_content" ||
                item.toolName === "multi_replace_file_content" ? (
                <DiffBlock item={item} file={file} />
              ) : item.toolName === "write_file" || item.toolName === "write_to_file" ? (
                <WriteFileBlock item={item} />
              ) : isListDir ? (
                <ListDirBlock item={item} />
              ) : (
                <CodeBlock
                  language={mcpFormatted?.lang ?? getToolResultLang(item)}
                  code={mcpFormatted?.code ?? item.text ?? ""}
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
