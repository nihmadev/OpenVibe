import React from "react";
import { HistoryItem } from "../chat-history/types.js";
import { describe, pickFile } from "../chat-history/utils.js";
import { FailIcon } from "../chat-history/ChatHistoryIcons.js";
import { FileBadge } from "../chat-history/ChatHistorySubComponents.js";
import { ChevronRightIcon } from "../icons/ui-icons.js";
import { FileIcon } from "../icons/file-icons.js";
import { useI18n } from "../../hooks/useI18n.js";
import { CodeBlock } from "../CodeBlock/CodeBlock.js";
import "../../styles/Tool.css";

export interface DiffSnippet {
  code: string;
  lang: string;
  decorations: Array<{ lineNumber: number; glyphClass: string; lineClass?: string }>;
  added: number;
  removed: number;
  modifed: number;
}

export function buildSnippet(
  args: Record<string, unknown>,
  fileContent: string,
): DiffSnippet | null {
  if (typeof args.old_str !== "string" || typeof args.new_str !== "string") return null;
  const oldStr = args.old_str;
  const newStr = args.new_str;
  if (!oldStr || !newStr) return null;

  const pos = fileContent.indexOf(newStr);
  if (pos === -1) return null;

  const oldContent = fileContent.slice(0, pos) + oldStr + fileContent.slice(pos + newStr.length);
  const allOld = oldContent.split("\n");
  const allNew = fileContent.split("\n");
  const oldSLines = oldStr.split("\n");
  const newSLines = newStr.split("\n");
  const changeIdx = fileContent.slice(0, pos).split("\n").length - 1;

  const ctx = 5;
  const ctxStart = Math.max(0, changeIdx - ctx);
  const oldEnd = changeIdx + oldSLines.length;
  const newEnd = changeIdx + newSLines.length;
  const oldCtxEnd = Math.min(allOld.length, oldEnd + ctx);
  const newCtxEnd = Math.min(allNew.length, newEnd + ctx);

  const snippetLines: Array<{ type: "add" | "remove" | "modifed" | "context"; text: string }> = [];

  // context before
  for (let i = ctxStart; i < changeIdx; i++) {
    if (i < allNew.length) snippetLines.push({ type: "context", text: allNew[i] ?? "" });
  }

  // change area — line-by-line at same offset
  const changeLen = Math.max(oldSLines.length, newSLines.length);
  for (let off = 0; off < changeLen; off++) {
    const oi2 = changeIdx + off;
    const ni2 = changeIdx + off;
    const hasOld = off < oldSLines.length && oi2 < allOld.length;
    const hasNew = off < newSLines.length && ni2 < allNew.length;
    const oldTxt = hasOld ? allOld[oi2] : "";
    const newTxt = hasNew ? allNew[ni2] : "";

    if (hasOld && hasNew) {
      if (oldTxt !== newTxt) {
        snippetLines.push({ type: "modifed", text: newTxt });
      } else {
        snippetLines.push({ type: "context", text: newTxt });
      }
    } else if (hasOld && !hasNew) {
      snippetLines.push({ type: "remove", text: oldTxt });
    } else if (!hasOld && hasNew) {
      snippetLines.push({ type: "add", text: newTxt });
    }
  }

  // context after
  for (let i = newEnd; i < newCtxEnd && i < allNew.length; i++) {
    snippetLines.push({ type: "context", text: allNew[i] ?? "" });
  }

  const code = snippetLines.map((l) => l.text).join("\n");

  const info = pickFile(args);
  const lang = info?.ext || "plaintext";

  const decorations = snippetLines
    .map((l, i) => {
      if (l.type === "context") return null;
      return {
        lineNumber: i + 1,
        glyphClass:
          l.type === "add"
            ? "tool__diff-glyph-add"
            : l.type === "remove"
              ? "tool__diff-glyph-remove"
              : "tool__diff-glyph-modifed",
        lineClass:
          l.type === "add"
            ? "tool__diff-line-bg-add"
            : l.type === "remove"
              ? "tool__diff-line-bg-remove"
              : "tool__diff-line-bg-modifed",
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const added = snippetLines.filter((l) => l.type === "add").length;
  const removed = snippetLines.filter((l) => l.type === "remove").length;
  const modifed = snippetLines.filter((l) => l.type === "modifed").length;

  return { code, lang, decorations, added, removed, modifed };
}

function DiffBlock({ item, file }: { item: HistoryItem; file?: { name: string } | null }) {
  const [snippet, setSnippet] = React.useState<DiffSnippet | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (item.ok !== true) { setLoading(false); return; }
    const args = item.toolArgs as Record<string, unknown> | undefined;
    const path = typeof args?.path === "string" ? args.path : typeof args?.file === "string" ? args.file : null;
    if (!path) { setLoading(false); return; }
    window.vibe.fs.read(path).then((r) => {
      if (r.ok) {
        const result = buildSnippet(args as Record<string, unknown>, r.content);
        setSnippet(result);
      }
      setLoading(false);
    });
  }, [item.id, item.ok]);

  return (
    <>
      <div className="tool__diff-header">
        <span className="tool__diff-header-left">
          <FileIcon name={file?.name} />
          <span className="tool__diff-fname">{file?.name}</span>
        </span>
        <span className="tool__diff-header-right">
          <span className="tool__diff-add">+{snippet?.added ?? 0}</span>
          <span className="tool__diff-remove">−{snippet?.removed ?? 0}</span>
        </span>
      </div>
      {loading && <div className="tool__diff-loading">Loading diff…</div>}
      {!loading && snippet && (
        <CodeBlock
          language={snippet.lang}
          code={snippet.code}
          decorations={snippet.decorations}
        />
      )}
    </>
  );
}

function WriteFileBlock({ item }: { item: HistoryItem }) {
  const [content, setContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (item.ok !== true) { setLoading(false); return; }
    const args = item.toolArgs as Record<string, unknown> | undefined;
    const path = typeof args?.path === "string" ? args.path : null;
    if (!path) { setLoading(false); return; }
    window.vibe.fs.read(path).then((r) => {
      if (r.ok) setContent(r.content);
      setLoading(false);
    });
  }, [item.id, item.ok]);

  if (loading) return <div className="tool__diff-loading">Loading…</div>;
  if (!content) return null;
  const lines = content.split("\n");
  const code = content;
  const info = pickFile(item.toolArgs);
  const lang = info?.ext || "plaintext";
  const decorations = lines.map((_, i) => ({
    lineNumber: i + 1,
    glyphClass: "tool__diff-glyph-add",
    lineClass: "tool__diff-line-bg-add",
  }));

  return (
    <>
      <div className="tool__diff-header">
        <span className="tool__diff-header-left">
          <FileIcon name={info?.name} />
          <span className="tool__diff-fname">{info?.name}</span>
        </span>
        <span className="tool__diff-header-right">
          <span className="tool__diff-add">+{lines.length}</span>
        </span>
      </div>
      <CodeBlock
        language={lang}
        code={code}
        decorations={decorations}
      />
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

export function AgentToolView({ item }: { item: HistoryItem }) {
  const { t } = useI18n();
  const { verb, file, suffix } = describe(item, t);
  const isPending = item.ok === undefined;
  const isErr = item.ok === false;
  const isListDir = item.toolName === "list_dir";
  const isSearchCodebase = item.toolName === "search_codebase";
  const [open, setOpen] = React.useState(false);

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

  const hasResultText = item.ok === true && !!item.text;
  const stateCls = isPending ? "tool--pending" : isErr ? "tool--err" : "tool--ok";
  const isReadFile = item.toolName === "read_file";
  const hasExpandable = (diffInfo !== null || hasResultText) && !isListDir && !isSearchCodebase && !isReadFile;

  return (
    <div className={`tool ${stateCls}${hasExpandable ? " tool--has-diff" : ""}`}>
      {isErr && (
        <span className="tool__icon"><FailIcon /></span>
      )}
      <span className="tool__line">
        <span className="tool__verb">{verb}</span>
        {file ? <> <FileBadge info={file} /></> : null}
        {hasExpandable && (
          <>
            {diffInfo && (
              <span className="tool__diff-stats">
                <span className="tool__diff-add">+{diffInfo.added}</span>
                <span className="tool__diff-remove">−{diffInfo.removed}</span>
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
          {item.toolName === "edit_file" ? (
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
