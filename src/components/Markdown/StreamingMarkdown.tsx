import React, { useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { escapeHtml } from "../../utils/string.js";
import { FileIcon, FolderIcon } from "../Icons/file-icons.js";
import { getFileIcon } from "../Icons/utils.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { CodeBlock } from "../CodeBlock/CodeBlock.js";

// ─── Pre-compiled regexes (module-level, not re-created on each render) ──

const MATH_PAREN_RE = /\\\((.*?)\\\)/g;
const MATH_BRACKET_RE = /\\\[([\s\S]*?)\\\]/g;
const MATH_BRACKET_FALLBACK_RE = /(^|\n)\[\s*([\s\S]*?\\frac[\s\S]*?)\s*\](\n|$)/g;

const FENCED_CODE_RE = /```(\w*)\n?([\s\S]*?)```/g;
const BLOCK_MATH_RE = /\$\$([\s\S]*?)\$\$/g;
const HEADING_RE = /^(#{1,6})\s+(.*)$/m;
const BLOCKQUOTE_RE = /^>\s?(.*)$/m;
const HR_RE = /^(?:[-*_]){3,}\s*$/m;
const TABLE_SEP_RE = /^\|.*---.*\|$/m;
const UNORDERED_LIST_RE = /^[-*+]\s+(.*)$/m;
const ORDERED_LIST_RE = /^\d+\.\s+(.*)$/m;

const FILE_EXTENSIONS =
  "tsx|ts|jsx|js|py|css|scss|html|json|md|mdx|yaml|yml|sh|dockerfile|env|toml|sql|png|jpg|jpeg|svg|ico|pdf|doc|docx|rb|go|rs|c|cpp|h|hpp|java|kt|lua|php|xml|txt|lock|exe|bin|patch|diff";

const LINE_START_FILE_RE = new RegExp(
  `(^|\\n)([\\t ]*(?:[-*+]|[0-9]+\\.)?[\\t ]*)([\\w\\-./]+\\.(?:${FILE_EXTENSIONS}))(?=\\b|\\s|$)`,
  "g",
);
const LINE_START_DOTFILE_RE = /(^|\n)([\t ]*(?:[-*+]|[0-9]+\.)?[\t ]*)(\.[\w\-.]+)(?!\/)(?=\b|\s|$)/g;
const EXTLESS_FILE_RE = /(^|\n)([\t ]*(?:[-*+]|[0-9]+\.)?[\t ]*)(LICENSE|COPYING|Dockerfile|Procfile)(?=\b|\s|$)/gi;
const EXPLICIT_FOLDER_RE = new RegExp(
  `(^|\\n)([\\t ]*(?:[-*+]|[0-9]+\\.)?[\\t ]*(?:Folder|folder):\\s*)([\\w\\-./]+)(?=\\b|\\s|$)`,
  "g",
);
const STANDALONE_FOLDER_RE = new RegExp(`(^|\\n)([\\t ]*(?:[-*+]|[0-9]+\\.)?[\\t ]*)([\\w\\-.]+\\/)(?=\\b|\\s|$)`, "g");

const USER_FILE_RE = new RegExp(`@([\\w\\-./]+\\.(?:${FILE_EXTENSIONS}))`, "g");
const USER_FOLDER_RE = /@((?:Folder:)?[\w\-./]+\/|(?:Folder:)?[\w\-./]+(?=\s+folder|Folder|$))/g;

const ESCAPE_RE = /&/g;
const LT_RE = /</g;

const INLINE_RE =
  /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`([^`\n]+)`)|(\$([^$\n]+?)\$)|(\[([^\]]+)\]\(([^)]+)\))|(<file>([^<]+)<\/file>)|(<folder>([^<]+)<\/folder>)/g;

export interface StreamingMarkdownProps {
  content: string;
  isAssistant?: boolean;
  noFileIcons?: boolean;
  simplifiedCodeBlocks?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function escapeHtmlCode(text: string): string {
  return escapeHtml(text);
}

function renderMath(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, { displayMode, throwOnError: false });
  } catch {
    return escapeHtml(value);
  }
}

// ─── Inline markdown → HTML ───────────────────────────────────────────────

const INLINE_MATH_RE = /\$([^$\n]+?)\$/g;

function inlineToHtml(text: string): string {
  if (!text) return "";
  let result = text.replace(
    INLINE_RE,
    (match, _b1, bold, _i1, italic, _c1, code, _m1, math, _l1, linkText, linkHref, _f1, file, _d1, folder) => {
      if (bold) return `<strong>${escapeHtml(bold)}</strong>`;
      if (italic) return `<em>${escapeHtml(italic)}</em>`;
      if (code) return `<code>${escapeHtml(code)}</code>`;
      if (math) return `<span class="math-inline">${renderMath(math, false)}</span>`;
      if (linkText && linkHref === "#file") return `<file>${escapeHtml(linkText)}</file>`;
      if (linkText && linkHref === "#folder") return `<folder>${escapeHtml(linkText)}</folder>`;
      if (linkText && linkHref) return `<a href="${escapeHtml(linkHref)}">${escapeHtml(linkText)}</a>`;
      if (file) return `<file>${escapeHtml(file)}</file>`;
      if (folder) return `<folder>${escapeHtml(folder)}</folder>`;
      return match;
    },
  );

  result = result.replace(INLINE_MATH_RE, (_, math) => {
    if (!math) return "$";
    return `<span class="math-inline">${renderMath(math, false)}</span>`;
  });

  return result;
}

// ─── File/folder ref → React element ──────────────────────────────────────

function renderFileRef(name: string, noFileIcons?: boolean): React.ReactElement {
  const rawName = name.startsWith("@") ? name.slice(1) : name;
  const icon = getFileIcon(rawName);
  if (noFileIcons) {
    return (
      <span className="inline-file" style={{ color: "var(--fg)" }}>
        {rawName}
      </span>
    );
  }
  return (
    <span
      className="inline-file"
      style={{ display: "inline-flex", alignItems: "center", gap: "4px", verticalAlign: "middle", color: "inherit" }}
    >
      {icon ? <FileIcon name={rawName} /> : null}
      {rawName}
    </span>
  );
}

function renderFolderRef(name: string, noFileIcons?: boolean): React.ReactElement {
  const rawName = name.startsWith("@") ? name.slice(1) : name;
  const folderName = rawName.replace(/^Folder:/, "").replace(/\/$/, "");
  if (noFileIcons) {
    return (
      <span className="inline-folder" style={{ color: "var(--fg)" }}>
        {rawName}
      </span>
    );
  }
  return (
    <span
      className="inline-folder"
      style={{ display: "inline-flex", alignItems: "center", gap: "4px", verticalAlign: "middle", color: "inherit" }}
    >
      <FolderIcon open={false} name={folderName} />
      {rawName}
    </span>
  );
}

const TAG_RE = /<file>([^<]+)<\/file>|<folder>([^<]+)<\/folder>/g;

function renderInlineHtml(html: string, noFileIcons?: boolean): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const before = html.slice(lastIndex, match.index);
      nodes.push(<span key={`t${lastIndex}`} dangerouslySetInnerHTML={{ __html: before }} />);
    }
    if (match[1] !== undefined) {
      nodes.push(<React.Fragment key={`f${match.index}`}>{renderFileRef(match[1], noFileIcons)}</React.Fragment>);
    } else if (match[2] !== undefined) {
      nodes.push(<React.Fragment key={`d${match.index}`}>{renderFolderRef(match[2], noFileIcons)}</React.Fragment>);
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    const remaining = html.slice(lastIndex);
    nodes.push(<span key={`t${lastIndex}`} dangerouslySetInnerHTML={{ __html: remaining }} />);
  }

  return nodes.length > 0 ? nodes : [html];
}

// ─── Code block ────────────────────────────────────────────────────────────

function AccentCodeBlock({ code }: { code: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const displayCode = code.trimEnd();
  const handleCopy = () => {
    navigator.clipboard.writeText(displayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const escaped = escapeHtmlCode(displayCode);
  return (
    <div className="code-block">
      <Tooltip text="Copy">
        <button className="code-block__copy" onClick={handleCopy}>
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
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </Tooltip>
      <div className="code-block__body">
        <pre className="code-block__pre">
          <code className="code-block__code" dangerouslySetInnerHTML={{ __html: escaped }} />
        </pre>
      </div>
    </div>
  );
}

function renderCodeBlock(lang: string, code: string, asAccent?: boolean, blockKey?: string): React.ReactElement {
  const key = blockKey || `cb-${code.slice(0, 40)}`;
  if (asAccent) {
    return <AccentCodeBlock key={key} code={code} />;
  }
  return <CodeBlock key={key} language={lang || "code"} code={code} />;
}

// ─── Math block ───────────────────────────────────────────────────────────

function renderMathBlock(latex: string, blockKey?: string): React.ReactElement {
  const trimmed = latex.trim();
  const html = renderMath(trimmed, true);
  const key = blockKey || `m${trimmed.slice(0, 40)}`;
  return (
    <div className="math math-block" key={key}>
      <span
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: "0",
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: "0",
          userSelect: "all",
        }}
      >
        {`$$${trimmed}$$`}
      </span>
      <span dangerouslySetInnerHTML={{ __html: html }} aria-hidden="true" style={{ userSelect: "none" }} />
    </div>
  );
}

// ─── Pre-process: math and file refs ───────────────────────────────────────

function preprocessContent(text: string, isAssistant: boolean): string {
  if (!text) return "";

  const t = text
    .replace(MATH_PAREN_RE, "$$ $1 $$")
    .replace(MATH_BRACKET_RE, "$$ $1 $$")
    .replace(MATH_BRACKET_FALLBACK_RE, "$1$$$$ $2 $$$$$3");

  const codeParts = t.split(/(```[\s\S]*?```|`[^`\n]*`)/g);

  return codeParts
    .map((part, i) => {
      if (i % 2 === 1) return part;

      if (!isAssistant) {
        part = part.replace(USER_FILE_RE, "[@$1](#file)");
        part = part.replace(USER_FOLDER_RE, "[@$1](#folder)");
        return part;
      }

      part = part.replace(LINE_START_FILE_RE, "$1$2[$3](#file)");
      part = part.replace(LINE_START_DOTFILE_RE, "$1$2[$3](#file)");
      part = part.replace(EXTLESS_FILE_RE, "$1$2[$3](#file)");
      part = part.replace(EXPLICIT_FOLDER_RE, "$1$2[$3](#folder)");
      part = part.replace(STANDALONE_FOLDER_RE, "$1$2[$3](#folder)");
      return part;
    })
    .join("");
}

// ─── Top-level StreamingMarkdown component ─────────────────────────────────

export const StreamingMarkdown = React.memo(function StreamingMarkdown({
  content,
  isAssistant,
  noFileIcons,
  simplifiedCodeBlocks,
}: StreamingMarkdownProps) {
  const elements = React.useMemo(() => {
    if (!content) return null;

    const processed = preprocessContent(content, !!isAssistant);

    // Collect block-level boundaries: code, math, then text
    type BlockSpan =
      | { start: number; end: number; type: "code"; lang: string; code: string }
      | { start: number; end: number; type: "math"; latex: string };

    const blocks: BlockSpan[] = [];

    FENCED_CODE_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FENCED_CODE_RE.exec(processed)) !== null) {
      blocks.push({
        start: m.index,
        end: m.index + m[0].length,
        type: "code",
        lang: m[1],
        code: m[2].replace(/\n$/, ""),
      });
    }

    BLOCK_MATH_RE.lastIndex = 0;
    while ((m = BLOCK_MATH_RE.exec(processed)) !== null) {
      blocks.push({ start: m.index, end: m.index + m[0].length, type: "math", latex: m[1] });
    }

    blocks.sort((a, b) => a.start - b.start);

    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let textSegmentIdx = 0;
    let codeBlockIdx = 0;
    let mathBlockIdx = 0;

    for (const b of blocks) {
      if (b.start > lastIndex) {
        const textBlock = processed.slice(lastIndex, b.start).trim();
        if (textBlock) {
          nodes.push(...renderTextBlock(textBlock, !!noFileIcons, `s${textSegmentIdx++}`));
        }
      }

      if (b.type === "code") {
        nodes.push(renderCodeBlock(b.lang, b.code, simplifiedCodeBlocks, `cb-${codeBlockIdx++}`));
      } else if (b.type === "math") {
        nodes.push(renderMathBlock(b.latex, `m-${mathBlockIdx++}`));
      }

      lastIndex = b.end;
    }

    if (lastIndex < processed.length) {
      const remaining = processed.slice(lastIndex).trim();
      if (remaining) {
        nodes.push(...renderTextBlock(remaining, !!noFileIcons, `s${textSegmentIdx++}`));
      }
    }

    return nodes.length > 0 ? nodes : null;
  }, [content, isAssistant, noFileIcons]);

  return <div className="markdown-body">{elements}</div>;
});

// ─── Table renderer ────────────────────────────────────────────────────────

function renderTable(rows: string[], noFileIcons: boolean, pk: string, startIndex: number): React.ReactElement {
  let cellKey = 0;
  const parseRow = (row: string, CellTag: "th" | "td"): React.ReactNode[] => {
    return row
      .split("|")
      .slice(1, -1)
      .map((cell) => {
        const html = inlineToHtml(cell.trim());
        return React.createElement(CellTag, { key: `c${cellKey++}` }, ...renderInlineHtml(html, noFileIcons));
      });
  };

  const headerRow = rows[0]!;
  const bodyRows = rows.slice(2);

  return (
    <table key={`${pk}t${startIndex}`}>
      <thead>
        <tr key="hdr">{parseRow(headerRow, "th")}</tr>
      </thead>
      <tbody>
        {bodyRows.map((row) => (
          <tr key={`r${cellKey++}`}>{parseRow(row, "td")}</tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Text block renderer ───────────────────────────────────────────────────

let textBlockCounter = 0;

let keyCounter = 0;

function renderTextBlock(text: string, noFileIcons: boolean, prefix?: string): React.ReactNode[] {
  if (!text) return [];
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  const pk = prefix ?? `t${textBlockCounter++}`;
  const nextKey = () => `${pk}${keyCounter++}`;

  while (i < lines.length) {
    const line = lines[i]!;

    if (HR_RE.test(line)) {
      nodes.push(<hr key={nextKey()} />);
      i++;
      continue;
    }

    const headingMatch = line.match(HEADING_RE);
    if (headingMatch?.[1]) {
      const level = headingMatch[1].length;
      const headingContent = headingMatch[2] ?? "";
      const html = inlineToHtml(headingContent);
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      nodes.push(<Tag key={nextKey()}>{renderInlineHtml(html, noFileIcons)}</Tag>);
      i++;
      continue;
    }

    const bqMatch = line.match(BLOCKQUOTE_RE);
    if (bqMatch) {
      const bqContent = bqMatch[1];
      const html = inlineToHtml(bqContent);
      nodes.push(<blockquote key={nextKey()}>{renderInlineHtml(html, noFileIcons)}</blockquote>);
      i++;
      continue;
    }

    if (UNORDERED_LIST_RE.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const liMatch = lines[i]!.match(UNORDERED_LIST_RE);
        if (!liMatch) break;
        const html = inlineToHtml(liMatch[1]);
        items.push(<li key={nextKey()}>{renderInlineHtml(html, noFileIcons)}</li>);
        i++;
      }
      nodes.push(<ul key={nextKey()}>{items}</ul>);
      continue;
    }

    if (ORDERED_LIST_RE.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length) {
        const liMatch = lines[i]!.match(ORDERED_LIST_RE);
        if (!liMatch) break;
        const html = inlineToHtml(liMatch[1]);
        items.push(<li key={nextKey()}>{renderInlineHtml(html, noFileIcons)}</li>);
        i++;
      }
      nodes.push(<ol key={nextKey()}>{items}</ol>);
      continue;
    }

    if (line.startsWith("|") && lines.length > i + 2 && TABLE_SEP_RE.test(lines[i + 1]!)) {
      const tableRows: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("|")) {
        tableRows.push(lines[i]!);
        i++;
      }
      if (tableRows.length >= 3) {
        nodes.push(renderTable(tableRows, noFileIcons, pk, i));
        continue;
      }
    }

    const html = inlineToHtml(line);
    nodes.push(<p key={nextKey()}>{renderInlineHtml(html, noFileIcons)}</p>);
    i++;
  }

  return nodes;
}
