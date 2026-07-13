import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ChevronRightIcon, RefreshIcon, CollapseAllIcon, FileIcon, FolderIcon, Loader2Icon } from "../icons/index.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useTranslate } from "../../hooks/useI18n.js";
import { useVirtualizer } from "@tanstack/react-virtual";
import "../../styles/SearchInCode.css";
import type { ContentMatch, FileGroupEntry } from "../../types.js";

interface SearchInCodeProps {
  cwd: string;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
  onClose: () => void;
}

// ── LRU cache for syntax highlighting ──

export class LRU<K, V> {
  private max: number;
  private map = new Map<K, V>();
  constructor(max: number) {
    this.max = max;
  }
  get(key: K): V | undefined {
    const val = this.map.get(key);
    if (val !== undefined) {
      this.map.delete(key);
      this.map.set(key, val);
    }
    return val;
  }
  set(key: K, val: V) {
    this.map.delete(key);
    this.map.set(key, val);
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value;
      if (first !== undefined) this.map.delete(first);
    }
  }
}

// ── Syntax highlighting ──

export interface Token {
  text: string;
  className: string;
}

const LANG_KEYWORDS: Record<string, string[]> = {
  ts: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "import",
    "export",
    "from",
    "async",
    "await",
    "type",
    "interface",
    "extends",
    "implements",
    "new",
    "this",
    "throw",
    "try",
    "catch",
    "finally",
    "switch",
    "case",
    "default",
    "break",
    "continue",
    "typeof",
    "instanceof",
    "in",
    "of",
    "as",
    "is",
    "satisfies",
    "keyof",
    "readonly",
    "static",
    "private",
    "protected",
    "public",
    "abstract",
    "declare",
  ],
  js: [
    "const",
    "let",
    "var",
    "function",
    "return",
    "if",
    "else",
    "for",
    "while",
    "class",
    "import",
    "export",
    "from",
    "async",
    "await",
    "new",
    "this",
    "throw",
    "try",
    "catch",
    "finally",
    "switch",
    "case",
    "default",
    "break",
    "continue",
    "typeof",
    "instanceof",
    "in",
    "of",
    "delete",
    "void",
  ],
  rs: [
    "fn",
    "let",
    "mut",
    "const",
    "if",
    "else",
    "for",
    "while",
    "loop",
    "return",
    "match",
    "pub",
    "use",
    "mod",
    "struct",
    "enum",
    "impl",
    "trait",
    "async",
    "await",
    "move",
    "ref",
    "self",
    "super",
    "crate",
    "where",
    "type",
    "dyn",
    "in",
    "as",
    "true",
    "false",
    "Some",
    "None",
    "Ok",
    "Err",
    "unsafe",
    "extern",
    "static",
    "const",
    "let",
    "match",
  ],
  py: [
    "def",
    "class",
    "return",
    "if",
    "elif",
    "else",
    "for",
    "while",
    "import",
    "from",
    "as",
    "with",
    "try",
    "except",
    "finally",
    "raise",
    "yield",
    "lambda",
    "pass",
    "break",
    "continue",
    "and",
    "or",
    "not",
    "in",
    "is",
    "True",
    "False",
    "None",
    "self",
    "async",
    "await",
  ],
  go: [
    "func",
    "return",
    "if",
    "else",
    "for",
    "range",
    "switch",
    "case",
    "default",
    "break",
    "continue",
    "var",
    "const",
    "type",
    "struct",
    "interface",
    "import",
    "package",
    "map",
    "chan",
    "go",
    "defer",
    "select",
    "fallthrough",
  ],
  java: [
    "public",
    "private",
    "protected",
    "static",
    "final",
    "class",
    "interface",
    "extends",
    "implements",
    "return",
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "default",
    "break",
    "continue",
    "new",
    "this",
    "super",
    "import",
    "package",
    "void",
    "int",
    "boolean",
    "String",
    "null",
    "true",
    "false",
    "throw",
    "throws",
    "try",
    "catch",
    "finally",
  ],
};

export function getLanguageFromFilename(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "ts",
    tsx: "ts",
    js: "js",
    jsx: "js",
    mjs: "js",
    cjs: "js",
    rs: "rs",
    py: "py",
    go: "go",
    java: "java",
    kt: "java",
    scala: "java",
    rb: "rb",
    php: "php",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "cs",
    swift: "swift",
    vue: "ts",
    svelte: "ts",
  };
  return map[ext] ?? "";
}

export function tokenizeLine(line: string, lang: string): Token[] {
  const tokens: Token[] = [];
  const keywords = LANG_KEYWORDS[lang] ?? [];
  let i = 0;
  while (i < line.length) {
    const strMatch = line.slice(i).match(/^'[^']*'|^"[^"]*"|^`[^`]*`/);
    if (strMatch) {
      tokens.push({ text: strMatch[0], className: "sc-token-string" });
      i += strMatch[0].length;
      continue;
    }
    if (line[i] === "/" && (line[i + 1] === "/" || line[i + 1] === "*")) {
      tokens.push({ text: line.slice(i), className: "sc-token-comment" });
      break;
    }
    const numMatch = line.slice(i).match(/^\d+(\.\d+)?/);
    if (numMatch) {
      tokens.push({ text: numMatch[0], className: "sc-token-number" });
      i += numMatch[0].length;
      continue;
    }
    const wordMatch = line.slice(i).match(/^[a-zA-Z_$][\w$]*/);
    if (wordMatch) {
      const word = wordMatch[0];
      if (keywords.includes(word)) {
        tokens.push({ text: word, className: "sc-token-keyword" });
      } else {
        tokens.push({ text: word, className: "sc-token-identifier" });
      }
      i += word.length;
      continue;
    }
    if (/\s/.test(line[i])) {
      let ws = "";
      while (i < line.length && /\s/.test(line[i])) {
        ws += line[i];
        i++;
      }
      tokens.push({ text: ws, className: "sc-token-ws" });
      continue;
    }
    tokens.push({ text: line[i], className: "sc-token-punctuation" });
    i++;
  }
  return tokens;
}

export function syntaxHighlightLine(line: string, lang: string, query: string, matchCase: boolean): React.ReactNode[] {
  const tokens = tokenizeLine(line, lang);
  const result: React.ReactNode[] = [];
  const q = matchCase ? query : query.toLowerCase();
  let key = 0;
  for (const token of tokens) {
    const txt = matchCase ? token.text : token.text.toLowerCase();
    let lastIdx = 0;
    let idx = txt.indexOf(q, 0);
    if (idx < 0) {
      result.push(
        <span key={key++} className={token.className}>
          {token.text}
        </span>,
      );
      continue;
    }
    const parts: React.ReactNode[] = [];
    while (idx >= 0) {
      if (idx > lastIdx) {
        parts.push(
          <span key={`t${lastIdx}`} className={token.className}>
            {token.text.slice(lastIdx, idx)}
          </span>,
        );
      }
      parts.push(
        <mark key={`m${idx}`} className="sc-match-highlight">
          {token.text.slice(idx, idx + query.length)}
        </mark>,
      );
      lastIdx = idx + query.length;
      idx = txt.indexOf(q, lastIdx);
    }
    if (lastIdx < token.text.length) {
      parts.push(
        <span key={`t${lastIdx}`} className={token.className}>
          {token.text.slice(lastIdx)}
        </span>,
      );
    }
    result.push(<span key={key++}>{parts}</span>);
  }
  return result;
}

const highlightCache = new LRU<string, React.ReactNode[]>(5000);

function getCachedHighlight(line: string, lang: string, query: string, matchCase: boolean): React.ReactNode[] {
  const key = `${line}\x00${lang}\x00${query}\x00${matchCase}`;
  const cached = highlightCache.get(key);
  if (cached) return cached;
  const result = syntaxHighlightLine(line, lang, query, matchCase);
  highlightCache.set(key, result);
  return result;
}

// ── Helpers for tree view ──

interface FileGroup {
  path: string;
  rel: string;
  name: string;
  matches: ContentMatch[];
}

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
  matches: ContentMatch[];
}

export function groupByFile(matches: ContentMatch[]): FileGroup[] {
  const map = new Map<string, ContentMatch[]>();
  for (const m of matches) {
    const existing = map.get(m.path);
    if (existing) existing.push(m);
    else map.set(m.path, [m]);
  }
  const groups: FileGroup[] = [];
  for (const [path, ms] of map) {
    groups.push({ path, rel: ms[0].rel, name: ms[0].name, matches: ms });
  }
  return groups;
}

export function buildTree(groups: FileGroup[]): TreeNode[] {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [], matches: [] };
  for (const g of groups) {
    const parts = g.rel.split("/");
    let current = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      let child = current.children.find((c) => c.name === part && c.isDir);
      if (!child) {
        const dirPath = parts.slice(0, i + 1).join("/");
        child = { name: part, path: dirPath, isDir: true, children: [], matches: [] };
        current.children.push(child);
      }
      current = child;
    }
    current.children.push({
      name: g.name,
      path: g.rel,
      isDir: false,
      children: [],
      matches: g.matches,
    });
  }
  return root.children;
}

export function sortNodes(nodes: TreeNode[]): TreeNode[] {
  const dirs = nodes.filter((n) => n.isDir);
  const files = nodes.filter((n) => !n.isDir);
  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));
  for (const d of dirs) {
    d.children = sortNodes(d.children);
  }
  return [...dirs, ...files];
}

export function globToRegex(pattern: string): RegExp {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      re += ".*";
      i++;
    } else if (ch === "*") {
      re += "[^/]*";
    } else if (ch === "?") {
      re += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      re += "\\" + ch;
    } else {
      re += ch;
    }
  }
  return new RegExp(re);
}

export function matchesGlob(path: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  return patterns.some((p) => globToRegex(p).test(path));
}

export function filterResults(
  matches: ContentMatch[],
  query: string,
  matchCase: boolean,
  matchWholeWord: boolean,
  useRegex: boolean,
  include: string,
  exclude: string,
): ContentMatch[] {
  const includePats = include
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const excludePats = exclude
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let wholeWordRe: RegExp | null = null;
  if (!useRegex && matchWholeWord && query) {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    wholeWordRe = new RegExp(matchCase ? `\\b${escaped}\\b` : `\\b${escaped}\\b`, matchCase ? "" : "i");
  }
  let regexRe: RegExp | null = null;
  if (useRegex && query) {
    try {
      regexRe = new RegExp(query, matchCase ? "" : "i");
    } catch {}
  }
  const qLower = !useRegex ? query.toLowerCase() : "";
  return matches.filter((m) => {
    if (!matchesGlob(m.rel, includePats)) return false;
    if (excludePats.length > 0 && matchesGlob(m.rel, excludePats)) return false;
    const line = m.content;
    if (regexRe) return regexRe.test(line);
    if (wholeWordRe) return wholeWordRe.test(line);
    if (matchCase) return line.includes(query);
    return line.toLowerCase().includes(qLower);
  });
}

// ── Icons ──

const MatchCaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.02602 3.34176C4.16218 2.93404 4.83818 2.93398 4.97426 3.34176L6.97426 9.34274C6.97526 9.34674 6.97817 9.35544 6.97817 9.35544L7.97426 12.3427C8.06126 12.6047 7.91984 12.8875 7.65786 12.9756C7.60486 12.9926 7.55165 13.0009 7.49965 13.0009C7.29082 13.0008 7.09602 12.868 7.02602 12.6591L6.14028 10.0009H2.86L1.97426 12.6591C1.88728 12.919 1.60634 13.0634 1.34243 12.9746C1.08043 12.8866 0.93902 12.6038 1.02602 12.3418L2.02211 9.35544C2.02311 9.35144 2.02602 9.34274 2.02602 9.34274L4.02602 3.34176ZM3.19399 8.99997H5.80629L4.49965 5.08102L3.19399 8.99997Z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.8581 6.66794C13.165 6.73296 13.9427 7.48427 13.9967 8.69626L13.9997 8.83297V12.5078C13.9957 12.7568 13.809 12.9621 13.568 12.9951L13.4997 13C13.2469 12.9998 13.0376 12.8121 13.0045 12.5683L12.9997 12.5V12.4297C12.3407 12.8066 11.7316 13 11.1666 13C9.94081 12.9998 8.99965 12.1369 8.99965 10.833C8.99967 9.68299 9.79211 8.82889 11.1061 8.66989C11.7279 8.59493 12.3589 8.64164 12.9987 8.80954C12.9915 8.07194 12.6279 7.70704 11.8082 7.66598C11.1672 7.63398 10.7158 7.72415 10.4518 7.90915C10.2258 8.06799 9.91347 8.01301 9.75551 7.78708C9.59671 7.56115 9.65178 7.24878 9.87758 7.09079C10.3165 6.78283 10.9138 6.64715 11.6666 6.6611L11.8581 6.66794ZM12.7965 9.8154C12.2587 9.66749 11.7361 9.62551 11.2262 9.68747C10.4042 9.78747 9.99868 10.2244 9.99868 10.8574C9.99884 11.5881 10.474 12.0242 11.1657 12.0244C11.6196 12.0244 12.1777 11.8137 12.8336 11.3818L12.9987 11.2695V9.87594L12.7965 9.8154Z"
    />
  </svg>
);

const WholeWordIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M15.5 12.5C15.776 12.5 16 12.724 16 13V13.5C16 14.327 15.327 15 14.5 15H1.5C0.673 15 0 14.327 0 13.5V13C0 12.724 0.224 12.5 0.5 12.5C0.776 12.5 1 12.724 1 13V13.5C1 13.775 1.224 14 1.5 14H14.5C14.776 14 15 13.775 15 13.5V13C15 12.724 15.224 12.5 15.5 12.5Z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.8584 5.6709C6.16516 5.73603 6.94308 6.48734 6.99707 7.69922L7 7.83594V11.5107C6.996 11.7596 6.80919 11.9649 6.56836 11.998L6.5 12.0029C6.24709 12.0029 6.038 11.8152 6.00488 11.5713L6 11.5029V11.4326C5.341 11.8096 4.73199 12.0029 4.16699 12.0029C2.941 12.0029 2 11.1399 2 9.83594C2.00003 8.68597 2.79247 7.83185 4.10645 7.67285C4.7283 7.59793 5.35918 7.64552 5.99902 7.81348C5.99202 7.07548 5.62762 6.70995 4.80762 6.66895C4.16686 6.637 3.7161 6.72717 3.45215 6.91211C3.22615 7.07111 2.91386 7.01604 2.75586 6.79004C2.5969 6.56404 2.65194 6.25174 2.87793 6.09375C3.31692 5.78579 3.91404 5.65006 4.66699 5.66406L4.8584 5.6709ZM5.79688 8.81836C5.25888 8.67037 4.73558 8.62843 4.22559 8.69043C3.40389 8.79054 2.99902 9.22747 2.99902 9.86035C2.99917 10.5911 3.47413 11.0273 4.16602 11.0273C4.62001 11.0273 5.17799 10.8168 5.83398 10.3848L5.99902 10.2725V8.87891L5.79688 8.81836Z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M9.55078 2.00586C9.78578 2.02986 9.97307 2.21715 9.99707 2.45215C10 2.46907 10 2.48601 10 2.50293V6.60254C10.418 6.22566 10.9371 6.00293 11.5 6.00293C12.881 6.00293 14 7.34596 14 9.00293C14 10.6599 12.881 12.0029 11.5 12.0029C10.9371 12.0029 10.418 11.7802 10 11.4033V11.5029C10 11.7619 9.80278 11.974 9.55078 12C9.53385 12.003 9.51693 12.0029 9.5 12.0029C9.224 12.0029 9 11.7789 9 11.5029V2.50293C9 2.486 9.00095 2.46907 9.00293 2.45215C9.02793 2.20015 9.241 2.00293 9.5 2.00293C9.51692 2.00293 9.53386 2.00388 9.55078 2.00586ZM11.4355 7.00391C11.0307 7.03208 10.5769 7.31545 10.29 7.82227C10.1232 8.12611 10.018 8.49479 10.002 8.89453C9.99995 8.92952 10 8.96597 10 9.00195C10 9.03795 10.001 9.07438 10.002 9.10938C10.018 9.50814 10.1222 9.87582 10.2891 10.1797C10.576 10.6875 11.0307 10.9728 11.4355 11C11.4565 11.002 11.478 11.002 11.5 11.002C11.522 11.002 11.5435 11.001 11.5645 11C11.9693 10.9728 12.424 10.6875 12.7109 10.1797C12.8778 9.87582 12.982 9.50814 12.998 9.10938C13 9.07438 13 9.03795 13 9.00195C13 8.96597 12.999 8.92952 12.998 8.89453C12.982 8.49479 12.8768 8.12611 12.71 7.82227C12.4231 7.31545 11.9693 7.03109 11.5645 7.00391C11.5435 7.00191 11.522 7.00195 11.5 7.00195C11.478 7.00195 11.4565 7.00291 11.4355 7.00391Z"
    />
  </svg>
);

const RegexIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M11.498 5H9.705L10.973 3.732C11.168 3.537 11.168 3.22 10.973 3.025C10.778 2.83 10.461 2.83 10.266 3.025L8.998 4.293V2.5C8.998 2.224 8.774 2 8.498 2C8.222 2 7.998 2.224 7.998 2.5V4.293L6.73 3.025C6.535 2.83 6.218 2.83 6.023 3.025C5.828 3.22 5.828 3.537 6.023 3.732L7.291 5H5.498C5.222 5 4.998 5.224 4.998 5.5C4.998 5.776 5.222 6 5.498 6H7.291L6.023 7.268C5.828 7.463 5.828 7.78 6.023 7.975C6.121 8.073 6.249 8.121 6.377 8.121C6.505 8.121 6.633 8.072 6.731 7.975L7.999 6.707V8.5C7.999 8.776 8.223 9 8.499 9C8.775 9 8.999 8.776 8.999 8.5V6.707L10.267 7.975C10.365 8.073 10.493 8.121 10.621 8.121C10.749 8.121 10.877 8.072 10.975 7.975C11.17 7.78 11.17 7.463 10.975 7.268L9.707 6H11.5C11.776 6 12 5.776 12 5.5C12 5.224 11.776 5 11.5 5H11.498ZM5 12C5 12.552 4.552 13 4 13C3.448 13 3 12.552 3 12C3 11.448 3.448 11 4 11C4.552 11 5 11.448 5 12Z" />
  </svg>
);

const PreserveCaseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.02602 3.3418C4.16216 2.93404 4.8382 2.93397 4.97426 3.3418L6.97426 9.34277C6.97526 9.34677 6.97817 9.35547 6.97817 9.35547L7.97426 12.3428C8.06126 12.6048 7.91985 12.8876 7.65786 12.9756C7.60486 12.9926 7.55165 13.001 7.49965 13.001C7.29083 13.0008 7.09603 12.868 7.02602 12.6592L6.14028 10.001H2.86L1.97426 12.6592C1.88727 12.919 1.60632 13.0634 1.34243 12.9746C1.08043 12.8866 0.93902 12.6038 1.02602 12.3418L2.02211 9.35547C2.02311 9.35147 2.02602 9.34277 2.02602 9.34277L4.02602 3.3418ZM3.19399 9H5.80629L4.49965 5.08105L3.19399 9Z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M11.4997 3C12.8777 3 13.9997 4.121 13.9997 5.5C13.9997 6.19496 13.7164 6.82435 13.2575 7.27734C14.2852 7.75346 14.9997 8.79421 14.9997 10C14.9997 11.654 13.6537 13 11.9997 13H9.49965C9.22381 12.9998 8.99965 12.7759 8.99965 12.5V3.5C8.99965 3.22411 9.22381 3.00018 9.49965 3H11.4997ZM9.99965 8V12H11.9997C13.1027 12 13.9997 11.103 13.9997 10C13.9997 8.897 13.1027 8 11.9997 8H9.99965ZM9.99965 4V7H11.4997C12.3267 7 12.9997 6.327 12.9997 5.5C12.9997 4.673 12.3267 4 11.4997 4H9.99965Z"
    />
  </svg>
);

const ReplaceAllIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M14 13V10C14 8.35 12.65 7 11 7H5.12L4.12 8H11C12.1 8 13 8.9 13 10V14C13.55 14 14 13.55 14 13Z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M10.999 5.5V2.75C10.999 1.765 10.12 1.25 9.25 1.25C8.362 1.25 7.989 1.553 7.896 1.646C7.701 1.841 7.687 2.17 7.882 2.365C8.076 2.561 8.379 2.573 8.575 2.378C8.57462 2.37825 8.57506 2.37797 8.575 2.378C8.58734 2.36997 8.77165 2.25 9.249 2.25C9.279 2.25 9.999 2.256 9.999 2.75V3.056C9.795 3.023 9.551 3 9.249 3C7.936 3 7.249 3.754 7.249 4.5C7.249 5.246 7.936 6 9.249 6C9.621 6 9.91 5.937 10.144 5.851C10.235 5.943 10.36 6 10.499 6C10.775 6 10.999 5.776 10.999 5.5ZM9.25 4C9.622 4 9.856 4.038 10 4.074V4.811C9.907 4.885 9.697 5 9.25 5C8.601 5 8.25 4.742 8.25 4.5C8.25 4.258 8.601 4 9.25 4Z"
    />
    <path d="M5.001 13.074C4.857 13.038 4.623 13 4.251 13C3.602 13 3.251 13.258 3.251 13.5C3.251 13.742 3.602 14 4.251 14C4.698 14 4.908 13.885 5.001 13.811V13.074Z" />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 15V10C12 9.448 11.552 9 11 9H2C1.448 9 1 9.448 1 10V15C1 15.552 1.448 16 2 16H11C11.552 16 12 15.552 12 15ZM4.251 10.25C5.121 10.25 6 10.765 6 11.75V14.5C6 14.776 5.776 15 5.5 15C5.361 15 5.236 14.943 5.145 14.851C4.911 14.937 4.622 15 4.25 15C2.937 15 2.25 14.246 2.25 13.5C2.25 12.754 2.937 12 4.25 12C4.552 12 4.796 12.023 5 12.056V11.75C5 11.256 4.28 11.25 4.25 11.25C3.78749 11.25 3.6007 11.3631 3.57831 11.3767C3.57688 11.3775 3.57612 11.378 3.576 11.378C3.38 11.573 3.077 11.561 2.883 11.365C2.688 11.17 2.702 10.841 2.897 10.646C2.99 10.553 3.363 10.25 4.251 10.25ZM8.33 11.611C8.117 11.877 8 12.237 8 12.625C8 13.013 8.117 13.373 8.33 13.639C8.699 14.101 9.31 13.982 9.539 13.778C9.743 13.591 10.059 13.609 10.245 13.814C10.43 14.019 10.414 14.335 10.208 14.52C9.86 14.834 9.442 15 9 15C8.445 15 7.929 14.739 7.549 14.264C7.195 13.82 7 13.239 7 12.625C7 12.011 7.195 11.429 7.549 10.986C8.233 10.134 9.422 10.02 10.209 10.73C10.414 10.915 10.431 11.231 10.246 11.436C10.06 11.64 9.744 11.658 9.54 11.472C9.311 11.266 8.701 11.147 8.33 11.611Z"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M14 6C15.103 6 16 4.991 16 3.75C16 2.509 15.103 1.5 14 1.5C13.634 1.5 13.295 1.619 13 1.813V0.5C13 0.224 12.776 0 12.5 0C12.224 0 12 0.224 12 0.5V5.5C12 5.776 12.224 6 12.5 6C12.717 6 12.897 5.86 12.966 5.666C13.269 5.873 13.62 6 14 6ZM14 2.5C14.552 2.5 15 3.061 15 3.75C15 4.439 14.552 5 14 5C13.448 5 13 4.439 13 3.75C13 3.061 13.448 2.5 14 2.5Z"
    />
    <path d="M1.99998 4.5C1.99998 3.673 2.67298 3 3.49998 3H5.50198C5.77798 3 6.00198 3.224 6.00198 3.5C6.00198 3.776 5.77798 4 5.50198 4H3.50198C3.22598 4 3.00198 4.225 3.00198 4.5V6.293L4.14798 5.147C4.34298 4.952 4.65998 4.952 4.85498 5.147C5.04998 5.342 5.04998 5.659 4.85498 5.854L2.85498 7.854C2.75698 7.951 2.62898 8 2.50098 8C2.37298 8 2.24498 7.952 2.14698 7.854L0.146982 5.854C-0.0480176 5.659 -0.0480176 5.342 0.146982 5.147C0.341982 4.952 0.658982 4.952 0.853982 5.147L1.99998 6.293V4.5Z" />
  </svg>
);

const ThreeDotIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M5 8C5 8.55229 4.55228 9 4 9C3.44772 9 3 8.55229 3 8C3 7.44772 3.44772 7 4 7C4.55228 7 5 7.44772 5 8ZM9 8C9 8.55229 8.55229 9 8 9C7.44772 9 7 8.55229 7 8C7 7.44772 7.44772 7 8 7C8.55229 7 9 7.44772 9 8ZM12 9C12.5523 9 13 8.55229 13 8C13 7.44772 12.5523 7 12 7C11.4477 7 11 7.44772 11 8C11 8.55229 11.4477 9 12 9Z" />
  </svg>
);

const ClearIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.5004 12.0004C13.7762 12.0006 14.0004 12.2245 14.0004 12.5004C14.0002 12.7761 13.7761 13.0002 13.5004 13.0004H2.50037C2.22449 13.0004 2.00056 12.7762 2.00037 12.5004C2.00037 12.2244 2.22437 12.0004 2.50037 12.0004H13.5004Z" />
    <path d="M13.5004 9.00037C13.7762 9.00056 14.0004 9.22449 14.0004 9.50037C14.0002 9.77608 13.7761 10.0002 13.5004 10.0004H2.50037C2.22449 10.0004 2.00056 9.7762 2.00037 9.50037C2.00037 9.22437 2.22437 9.00037 2.50037 9.00037H13.5004Z" />
    <path d="M13.5004 6.00037C13.7762 6.00056 14.0004 6.22449 14.0004 6.50037C14.0002 6.77608 13.7761 7.00017 13.5004 7.00037H7.50037C7.22449 7.00037 7.00056 6.7762 7.00037 6.50037C7.00037 6.22437 7.22437 6.00037 7.50037 6.00037H13.5004Z" />
    <path d="M13.5004 3.00037C13.7762 3.00056 14.0004 3.22449 14.0004 3.50037C14.0002 3.77608 13.7761 4.00017 13.5004 4.00037H7.50037C7.22449 4.00037 7.00056 3.7762 7.00037 3.50037C7.00037 3.22437 7.22437 3.00037 7.50037 3.00037H13.5004Z" />
  </svg>
);

const TreeViewIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2 3.5C2 3.22386 2.22386 3 2.5 3H13.5C13.7761 3 14 3.22386 14 3.5C14 3.77614 13.7761 4 13.5 4H6V6H13.5C13.7761 6 14 6.22386 14 6.5C14 6.77614 13.7761 7 13.5 7H6V9H13.5C13.7761 9 14 9.22386 14 9.5C14 9.77614 13.7761 10 13.5 10H6V12H13.5C13.7761 12 14 12.2239 14 12.5C14 12.7761 13.7761 13 13.5 13H5.5C5.22386 13 5 12.7761 5 12.5V4H2.5C2.22386 4 2 3.77614 2 3.5Z" />
  </svg>
);

// ── Component ──

export function SearchInCode({ cwd, onOpenFile, onClose }: SearchInCodeProps): React.ReactElement {
  const t = useTranslate();
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [preserveCase, setPreserveCase] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [includeFilter, setIncludeFilter] = useState("");
  const [excludeFilter, setExcludeFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [viewAsTree, setViewAsTree] = useState(false);
  const [collapsedTree, setCollapsedTree] = useState<Set<string>>(new Set());

  // Two-phase search state
  const [fileEntries, setFileEntries] = useState<FileGroupEntry[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [fileMatchesMap, setFileMatchesMap] = useState<Record<string, { matches: ContentMatch[]; total: number }>>({});
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchParamsRef = useRef({ query, useRegex, includeFilter, excludeFilter, matchCase, matchWholeWord, cwd });
  searchParamsRef.current = { query, useRegex, includeFilter, excludeFilter, matchCase, matchWholeWord, cwd };
  const searchGenRef = useRef(0);
  const treePreloadGenRef = useRef(0);
  const committedQueryRef = useRef({ query: "", matchCase: false, lang: "" });

  // Refs to avoid stale closures in async callbacks
  const fileMatchesRef = useRef(fileMatchesMap);
  fileMatchesRef.current = fileMatchesMap;
  const loadingFilesRef = useRef(loadingFiles);
  loadingFilesRef.current = loadingFiles;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load matches for a specific file
  const loadFileMatches = useCallback(async (path: string) => {
    if (fileMatchesRef.current[path] || loadingFilesRef.current.has(path)) return;
    const p = searchParamsRef.current;
    const gen = searchGenRef.current;
    setLoadingFiles((prev) => new Set(prev).add(path));
    try {
      const res = await (window as any).vibe.fs.searchContentFileMatches(
        p.cwd,
        p.query,
        p.matchCase,
        p.matchWholeWord,
        p.useRegex,
        p.includeFilter,
        p.excludeFilter,
        path,
        0,
        200,
      );
      if (res.ok && gen === searchGenRef.current) {
        setFileMatchesMap((prev) => ({ ...prev, [path]: { matches: res.matches ?? [], total: res.total } }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, []);

  const scheduleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const queryStr = q;
      const gen = ++searchGenRef.current;
      treePreloadGenRef.current = 0;
      debounceRef.current = setTimeout(async () => {
        if (!queryStr.trim() || !cwd) {
          setFileEntries([]);
          setTotalMatches(0);
          setFileMatchesMap({});
          committedQueryRef.current = { query: "", matchCase: false, lang: "" };
          return;
        }
        const p = searchParamsRef.current;
        setSearching(true);
        setFileMatchesMap({});
        try {
          const res = await (window as any).vibe.fs.searchContentFiles(
            p.cwd,
            queryStr.trim(),
            p.matchCase,
            p.matchWholeWord,
            p.useRegex,
            p.includeFilter || undefined,
            p.excludeFilter || undefined,
            1000,
          );
          if (res.ok && gen === searchGenRef.current) {
            setFileEntries(res.files ?? []);
            setTotalMatches(res.totalMatches ?? 0);
            committedQueryRef.current = { query: queryStr.trim(), matchCase: p.matchCase, lang: "" };
            // Initially collapse all files — matches load on toggle
            if (res.files && res.files.length > 0) {
              setCollapsedFiles(new Set(res.files.map((f: FileGroupEntry) => f.path)));
            }
          } else {
            setFileEntries([]);
            setTotalMatches(0);
          }
        } catch {
          setFileEntries([]);
          setTotalMatches(0);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [cwd],
  );

  const handleQueryChange = useCallback(
    (val: string) => {
      setQuery(val);
      scheduleSearch(val);
    },
    [scheduleSearch],
  );

  const requery = useCallback(() => {
    if (searchParamsRef.current.query.trim()) {
      scheduleSearch(searchParamsRef.current.query);
    }
  }, [scheduleSearch]);

  const handleRefresh = useCallback(() => {
    requery();
  }, [requery]);

  const handleClear = useCallback(() => {
    setQuery("");
    setFileEntries([]);
    setTotalMatches(0);
    setFileMatchesMap({});
    committedQueryRef.current = { query: "", matchCase: false, lang: "" };
    inputRef.current?.focus();
  }, []);

  // Auto-load matches when file is expanded
  const toggleFile = useCallback(
    (path: string) => {
      setCollapsedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
          // Load matches immediately when expanding (no "click to load" delay)
          loadFileMatches(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [loadFileMatches],
  );

  // Debounced re-query when include/exclude filters change
  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      requery();
    }, 500);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [includeFilter, excludeFilter, requery]);

  // ── Build flat rows for virtualizer ──

  type FlatRow =
    | {
        key: string;
        type: "file-header";
        fileIndex: number;
      }
    | {
        key: string;
        type: "match";
        fileIndex: number;
        matchIndex: number;
      };

  const flatRows: FlatRow[] = useMemo(() => {
    const rows: FlatRow[] = [];
    for (let i = 0; i < fileEntries.length; i++) {
      rows.push({ key: `fh-${i}`, type: "file-header", fileIndex: i });
      const entry = fileEntries[i]!;
      if (!collapsedFiles.has(entry.path)) {
        const fm = fileMatchesMap[entry.path];
        if (fm) {
          const count = Math.min(fm.matches.length, 200);
          for (let j = 0; j < count; j++) {
            rows.push({ key: `m-${i}-${j}`, type: "match", fileIndex: i, matchIndex: j });
          }
          if (fm.matches.length > 200) {
            rows.push({ key: `mm-${i}`, type: "match", fileIndex: i, matchIndex: -2 });
          }
        } else {
          rows.push({ key: `ld-${i}`, type: "match", fileIndex: i, matchIndex: -1 });
        }
      }
    }
    return rows;
  }, [fileEntries, collapsedFiles, fileMatchesMap]);

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => resultsRef.current,
    estimateSize: (index) => {
      const row = flatRows[index];
      return row?.type === "file-header" ? 28 : 22;
    },
    overscan: 20,
  });

  // ── Compute tree view data only when needed ──

  const groups = useMemo(() => {
    if (viewAsTree) {
      const allMatches: ContentMatch[] = [];
      for (const entry of fileEntries) {
        const fm = fileMatchesMap[entry.path];
        if (fm) allMatches.push(...fm.matches);
      }
      return groupByFile(allMatches);
    }
    return [];
  }, [viewAsTree, fileEntries, fileMatchesMap]);

  const treeNodes = useMemo(() => {
    if (viewAsTree) {
      return sortNodes(buildTree(groups));
    }
    return [];
  }, [viewAsTree, groups]);

  // ── Collapse handlers ──

  const handleCollapseAll = useCallback(() => {
    if (viewAsTree) {
      const all: string[] = [];
      const collect = (nodes: TreeNode[], parentPath = "") => {
        for (const n of nodes) {
          const p = parentPath ? `${parentPath}/${n.name}` : n.name;
          all.push(p);
          collect(n.children, p);
        }
      };
      collect(treeNodes);
      setCollapsedTree(new Set(all));
    } else {
      const all = fileEntries.map((g) => g.path);
      setCollapsedFiles(new Set(all));
    }
  }, [fileEntries, treeNodes, viewAsTree]);

  const toggleTreeNode = useCallback((path: string) => {
    setCollapsedTree((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Preload file matches when tree view is active
  useEffect(() => {
    if (!viewAsTree || fileEntries.length === 0) return;
    const gen = searchGenRef.current;
    if (treePreloadGenRef.current === gen) return;
    treePreloadGenRef.current = gen;
    for (const entry of fileEntries) {
      loadFileMatches(entry.path);
    }
  }, [viewAsTree, fileEntries, loadFileMatches]);

  // ── Tree row renderer ──

  const renderTreeRow = (node: TreeNode, depth: number, guidePositions: number[]): React.ReactNode[] => {
    const nodePath = node.path;
    const collapsed = collapsedTree.has(nodePath);
    const hasChildren = node.children.length > 0 || node.matches.length > 0;
    const elements: React.ReactNode[] = [];
    elements.push(
      <div
        key={`row-${nodePath}`}
        className="sc-tree-row"
        style={{ paddingLeft: 8 + depth * 10 }}
        onClick={() => {
          if (node.isDir) toggleTreeNode(nodePath);
          else if (node.matches.length > 0) toggleTreeNode(nodePath);
        }}
      >
        {guidePositions.map((pos, i) => (
          <span key={i} className="sc-guide-line" style={{ left: pos }} />
        ))}
        <span
          className="sc-chev"
          onClick={(e) => {
            e.stopPropagation();
            toggleTreeNode(nodePath);
          }}
        >
          {hasChildren && <ChevronRightIcon open={!collapsed} />}
        </span>
        {node.isDir ? <FolderIcon open={false} name={node.name} /> : <FileIcon name={node.name} />}
        <span className="sc-tree-name">{node.name}</span>
        {!node.isDir && node.matches.length > 0 && (
          <>
            <span className="sc-tree-path">{node.path}</span>
            <span className="sc-match-badge">{node.matches.length}</span>
          </>
        )}
      </div>,
    );
    if (!collapsed && hasChildren) {
      const childGuidePositions = [...guidePositions, 8 + depth * 10 + 6];
      if (node.children.length > 0) {
        node.children.forEach((child) => {
          elements.push(...renderTreeRow(child, depth + 1, childGuidePositions));
        });
      }
      if (node.matches.length > 0) {
        node.matches.forEach((m) => {
          const lang = getLanguageFromFilename(m.name);
          elements.push(
            <div
              key={`match-${m.path}:${m.line}`}
              className="sc-match-row"
              style={{ paddingLeft: 8 + (depth + 1) * 10 + 14 }}
              onClick={() => { onOpenFile(m.path, m.line, m.column, committedQueryRef.current.query.length); onClose(); }}
            >
              {guidePositions.map((pos, i) => (
                <span key={i} className="sc-guide-line" style={{ left: pos }} />
              ))}
              <span className="sc-match-content">
                {getCachedHighlight(
                  m.content,
                  lang,
                  committedQueryRef.current.query,
                  committedQueryRef.current.matchCase,
                )}
              </span>
            </div>,
          );
        });
      }
    }
    return elements;
  };

  const fileCount = fileEntries.length;
  const resultCount = totalMatches;

  // Separate component to allow React.memo on each match row
  const MatchRow = React.useCallback(
    ({
      m,
      lang,
      isLastMatch,
      onOpenFile,
    }: {
      m: ContentMatch;
      lang: string;
      isLastMatch: boolean;
      onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
      onClose: () => void;
    }) => {
      const { query: cq, matchCase: cmc } = committedQueryRef.current;
      return (
        <div className={`sc-match-row${isLastMatch ? " sc-match-row--last" : ""}`} onClick={() => { onOpenFile(m.path, m.line, m.column, cq.length); onClose(); }}>
          <span className="sc-match-content">{getCachedHighlight(m.content, lang, cq, cmc)}</span>
        </div>
      );
    },
    [],
  );
  const MatchRowMemo = React.useMemo(
    () =>
      React.memo(
        MatchRow,
        (prev, next) =>
          prev.m.path === next.m.path &&
          prev.m.line === next.m.line &&
          prev.m.content === next.m.content &&
          prev.lang === next.lang &&
          prev.isLastMatch === next.isLastMatch,
      ),
    [MatchRow],
  );

  return (
    <div className="search-code">
      <div className="sc-header">
        <span className="sc-header-title">{t("searchInCode")}</span>
        <div className="sc-header-actions">
          <Tooltip text={t("refreshSearch")}>
            <button className="sc-action-btn" onClick={handleRefresh} aria-label={t("refreshSearch")}>
              <RefreshIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("clearSearchResults")}>
            <button className="sc-action-btn" onClick={handleClear} aria-label={t("clearSearchResults")}>
              <ClearIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("viewAsTree")}>
            <button
              className={`sc-action-btn ${viewAsTree ? "sc-action-btn--active" : ""}`}
              onClick={() => setViewAsTree((v) => !v)}
              aria-label={t("viewAsTree")}
            >
              <TreeViewIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("collapseAllTooltip")}>
            <button className="sc-action-btn" onClick={handleCollapseAll} aria-label={t("collapseAllTooltip")}>
              <CollapseAllIcon />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="sc-inputs">
        <div className="sc-inputs-inner">
          <Tooltip text={replaceOpen ? t("hideReplace") : t("showReplace")}>
            <button
              className={`sc-chevron-btn ${replaceOpen ? "sc-chevron-btn--open" : ""}`}
              onClick={() => setReplaceOpen((v) => !v)}
              aria-label={replaceOpen ? t("hideReplace") : t("showReplace")}
            >
              <ChevronRightIcon open={replaceOpen} />
            </button>
          </Tooltip>
          <div className="sc-input-fields">
            <div className="sc-input-row">
              <div className="sc-input-wrap">
                <input
                  ref={inputRef}
                  className="sc-input"
                  type="text"
                  placeholder={t("searchInCodePlaceholder")}
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") scheduleSearch(query);
                  }}
                  aria-label={t("searchInCodePlaceholder")}
                />
                <div className="sc-input-toggles">
                  <Tooltip text={t("matchCase")}>
                    <button
                      className={`sc-toggle-btn ${matchCase ? "sc-toggle-btn--active" : ""}`}
                      onClick={() => {
                        setMatchCase((v) => !v);
                        requery();
                      }}
                      aria-label={t("matchCase")}
                    >
                      <MatchCaseIcon />
                    </button>
                  </Tooltip>
                  <Tooltip text={t("matchWholeWord")}>
                    <button
                      className={`sc-toggle-btn ${matchWholeWord ? "sc-toggle-btn--active" : ""}`}
                      onClick={() => {
                        setMatchWholeWord((v) => !v);
                        requery();
                      }}
                      aria-label={t("matchWholeWord")}
                    >
                      <WholeWordIcon />
                    </button>
                  </Tooltip>
                  <Tooltip text={t("useRegex")}>
                    <button
                      className={`sc-toggle-btn ${useRegex ? "sc-toggle-btn--active" : ""}`}
                      onClick={() => {
                        setUseRegex((v) => !v);
                        scheduleSearch(query);
                      }}
                      aria-label={t("useRegex")}
                    >
                      <RegexIcon />
                    </button>
                  </Tooltip>
                </div>
              </div>
            </div>

            <div className={`sc-replace-wrap ${replaceOpen ? "sc-replace-wrap--open" : ""}`}>
              <div className="sc-input-row sc-input-row--replace">
                <div className="sc-input-wrap">
                  <input
                    className="sc-input"
                    type="text"
                    placeholder={t("replacePlaceholder")}
                    value={replaceText}
                    onChange={(e) => setReplaceText(e.target.value)}
                    aria-label={t("replacePlaceholder")}
                  />
                  <div className="sc-input-toggles">
                    <Tooltip text={t("preserveCase")}>
                      <button
                        className={`sc-toggle-btn ${preserveCase ? "sc-toggle-btn--active" : ""}`}
                        onClick={() => setPreserveCase((v) => !v)}
                        aria-label={t("preserveCase")}
                      >
                        <PreserveCaseIcon />
                      </button>
                    </Tooltip>
                    <Tooltip text={t("replaceAll")}>
                      <button className="sc-action-btn" aria-label={t("replaceAll")}>
                        <ReplaceAllIcon />
                      </button>
                    </Tooltip>
                    <Tooltip text={t("filesToIncludeExclude")}>
                      <button
                        className={`sc-action-btn ${showFilters ? "sc-action-btn--active" : ""}`}
                        onClick={() => setShowFilters((v) => !v)}
                        aria-label={t("filesToIncludeExclude")}
                      >
                        <ThreeDotIcon />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`sc-filters-wrap ${showFilters ? "sc-filters-wrap--open" : ""}`}>
          <div className="sc-filters">
            <div className="sc-filter-row">
              <span className="sc-filter-label">{t("filesToInclude")}</span>
              <div className="sc-input-wrap">
                <input
                  className="sc-input"
                  type="text"
                  placeholder={t("includePlaceholder")}
                  value={includeFilter}
                  onChange={(e) => {
                    setIncludeFilter(e.target.value);
                  }}
                  aria-label={t("filesToInclude")}
                />
              </div>
            </div>
            <div className="sc-filter-row">
              <span className="sc-filter-label">{t("filesToExclude")}</span>
              <div className="sc-input-wrap">
                <input
                  className="sc-input"
                  type="text"
                  placeholder={t("excludePlaceholder")}
                  value={excludeFilter}
                  onChange={(e) => {
                    setExcludeFilter(e.target.value);
                  }}
                  aria-label={t("filesToExclude")}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {query.trim() && !searching && (
        <div className="sc-summary">
          <span className="sc-summary-text">
            {resultCount === 0
              ? t("noResultsFound")
              : (() => {
                  const mod10 = resultCount % 10;
                  const mod100 = resultCount % 100;
                  let key: string;
                  if (mod10 === 1 && mod100 !== 11) key = "searchInCodeResults_one";
                  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) key = "searchInCodeResults_few";
                  else key = "searchInCodeResults";
                  return t(key, { count: String(resultCount), fileCount: String(fileCount) });
                })()}
          </span>
        </div>
      )}

      <div className="sc-results" ref={resultsRef}>
        {searching && !fileEntries.length && (
          <div className="sc-loading">
            <Loader2Icon />
          </div>
        )}

        {!query.trim() && !searching && <div className="sc-empty">{t("typeToSearch")}</div>}

        {!viewAsTree && fileEntries.length > 0 && (
          <div className="sc-flat-list" style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = flatRows[virtualRow.index];
              if (!row) return null;
              const entry = fileEntries[row.fileIndex];
              if (!entry) return null;

              if (row.type === "file-header") {
                const collapsed = collapsedFiles.has(entry.path);
                return (
                  <div
                    key={row.key}
                    className="sc-file-group"
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <div className="sc-file-header" onClick={() => toggleFile(entry.path)}>
                      <span className="sc-chev">
                        <ChevronRightIcon open={!collapsed} />
                      </span>
                      <FileIcon name={entry.name} />
                      <span className="sc-file-name">{entry.name}</span>
                      <span className="sc-file-path">{entry.rel}</span>
                      <span className="sc-match-badge">{entry.matchCount}</span>
                    </div>
                  </div>
                );
              }

              // Match row
              const fm = fileMatchesMap[entry.path];
              if (row.matchIndex === -1 || !fm) {
                // Loading placeholder
                return (
                  <div
                    key={row.key}
                    className="sc-match-row"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingLeft: 32,
                      color: "var(--fg-muted)",
                    }}
                  >
                    {loadingFiles.has(entry.path) ? t("loadingMatches") : ""}
                  </div>
                );
              }
              if (row.matchIndex === -2) {
                // "… and N more matches" row
                return (
                  <div
                    key={row.key}
                    className="sc-match-row sc-match-row--last"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      color: "var(--fg-muted)",
                      fontStyle: "italic",
                      paddingLeft: 32,
                      cursor: "default",
                    }}
                  >
                    {t("moreMatches", { count: String(fm.total - 200) })}
                  </div>
                );
              }
              const m = fm.matches[row.matchIndex];
              if (!m) return null;
              const isLastMatch = row.matchIndex === fm.matches.length - 1 || row.matchIndex === 199;
              const lang = getLanguageFromFilename(entry.name);
              return (
                <div
                  key={row.key}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.matchIndex < 200 ? (
                    <MatchRowMemo m={m} lang={lang} isLastMatch={isLastMatch} onOpenFile={onOpenFile} onClose={onClose} />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        {viewAsTree && treeNodes.length > 0 && (
          <div className="sc-tree-view">{treeNodes.map((node) => renderTreeRow(node, 0, []))}</div>
        )}
      </div>
    </div>
  );
}
