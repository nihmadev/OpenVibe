import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ChevronRightIcon,
  RefreshIcon,
  CollapseAllIcon,
  FileIcon,
  FolderIcon,
  Loader2Icon,
  MatchCaseIcon,
  WholeWordIcon,
  RegexIcon,
  PreserveCaseIcon,
  ReplaceAllIcon,
  ThreeDotIcon,
  ClearIcon,
  TreeViewIcon,
} from "../icons/index.js";
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
  let key = 0;
  if (!query) {
    return tokens.map((token) => (
      <span key={key++} className={token.className}>
        {token.text}
      </span>
    ));
  }
  const result: React.ReactNode[] = [];
  const q = matchCase ? query : query.toLowerCase();
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
  relDir: string;
  children: TreeNode[];
  matchesCount: number;
  matches: ContentMatch[];
}

export function groupByFile(matches: ContentMatch[]): FileGroup[] {
  const map = new Map<string, FileGroup>();
  for (const m of matches) {
    let group = map.get(m.rel);
    if (!group) {
      group = { path: m.path, rel: m.rel, name: m.name, matches: [] };
      map.set(m.rel, group);
    }
    group.matches.push(m);
  }
  return Array.from(map.values());
}

export function buildTree(groups: FileGroup[]): TreeNode[] {
  const rootNodes: TreeNode[] = [];
  const dirMap = new Map<string, TreeNode>();

  function getOrCreateDir(dirPath: string): TreeNode {
    if (dirMap.has(dirPath)) return dirMap.get(dirPath)!;
    const parts = dirPath.split("/");
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/");
    const node: TreeNode = {
      name,
      path: dirPath,
      isDir: true,
      relDir: dirPath,
      children: [],
      matchesCount: 0,
      matches: [],
    };
    dirMap.set(dirPath, node);
    if (parentPath) {
      const parent = getOrCreateDir(parentPath);
      parent.children.push(node);
    } else {
      rootNodes.push(node);
    }
    return node;
  }

  for (const group of groups) {
    const parts = group.rel.split("/");
    const fileName = parts.pop()!;
    const dirPath = parts.join("/");
    const fileNode: TreeNode = {
      name: fileName,
      path: group.rel,
      isDir: false,
      relDir: dirPath,
      children: [],
      matchesCount: group.matches.length,
      matches: group.matches,
    };
    if (dirPath) {
      const parent = getOrCreateDir(dirPath);
      parent.children.push(fileNode);
      let curr: string | undefined = dirPath;
      while (curr) {
        const d = dirMap.get(curr);
        if (d) d.matchesCount += group.matches.length;
        const p = curr.split("/").slice(0, -1).join("/");
        curr = p || undefined;
      }
    } else {
      rootNodes.push(fileNode);
    }
  }

  return sortNodes(rootNodes);
}

export function sortNodes(nodes: TreeNode[]): TreeNode[] {
  const dirs = nodes.filter((n) => n.isDir).sort((a, b) => a.name.localeCompare(b.name));
  const files = nodes.filter((n) => !n.isDir).sort((a, b) => a.name.localeCompare(b.name));
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
      if (pattern[i + 2] === "/") {
        re += "(?:.*/)?";
        i += 2;
      } else {
        re += ".*";
        i++;
      }
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
  const prefix = pattern.includes("/") ? "^" : "(?:^|.*/)";
  return new RegExp(`${prefix}${re}$`);
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
    } catch {
      // ignore invalid regex query
    }
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

// (icons now imported from ../icons/index.js)

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

  const [selectedIndex, setSelectedIndex] = useState(-1);
  const keyboardNavRef = useRef(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Reset keyboard selection when results or view mode changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [viewAsTree, query, fileEntries]);

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

  // ── Keyboard handler for the search input ──

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        scheduleSearch(query);
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.blur();
        return;
      }
    },
    [query, scheduleSearch],
  );

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

  // ── Keyboard navigation ──

  function keyboardSetIndex(i: number): void {
    keyboardNavRef.current = true;
    setSelectedIndex(i);
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const hasResults = !viewAsTree && flatRows.length > 0;

      if (isInput && (e.ctrlKey || e.metaKey) && e.key.length === 1) return;
      if (isInput && e.key.length === 1) return;

      if (!hasResults) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        keyboardSetIndex(selectedIndex < flatRows.length - 1 ? selectedIndex + 1 : 0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        keyboardSetIndex(selectedIndex > 0 ? selectedIndex - 1 : flatRows.length - 1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        keyboardSetIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        keyboardSetIndex(flatRows.length - 1);
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        keyboardSetIndex(Math.min(selectedIndex + 20, flatRows.length - 1));
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        keyboardSetIndex(Math.max(selectedIndex - 20, 0));
        return;
      }

      if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const row = flatRows[selectedIndex];
        if (!row) return;
        if (row.type === "file-header") {
          const entry = fileEntries[row.fileIndex];
          if (!entry) return;
          const fm = fileMatchesMap[entry.path];
          if (fm && fm.matches.length > 0) {
            const m = fm.matches[0]!;
            onOpenFile(m.path, m.line, m.column, committedQueryRef.current.query.length);
            onClose();
          } else if (!collapsedFiles.has(entry.path)) {
            toggleFile(entry.path);
          } else {
            toggleFile(entry.path);
          }
        } else if (row.matchIndex >= 0) {
          const entry = fileEntries[row.fileIndex];
          if (!entry) return;
          const fm = fileMatchesMap[entry.path];
          if (fm && fm.matches[row.matchIndex]) {
            const m = fm.matches[row.matchIndex]!;
            onOpenFile(m.path, m.line, m.column, committedQueryRef.current.query.length);
            onClose();
          }
        }
        return;
      }

      if (e.key === "ArrowRight" && selectedIndex >= 0) {
        const row = flatRows[selectedIndex];
        if (row?.type === "file-header") {
          const path = fileEntries[row.fileIndex]!.path;
          if (collapsedFiles.has(path)) toggleFile(path);
        }
        return;
      }
      if (e.key === "ArrowLeft" && selectedIndex >= 0) {
        const row = flatRows[selectedIndex];
        if (row?.type === "file-header") {
          const path = fileEntries[row.fileIndex]!.path;
          if (!collapsedFiles.has(path)) toggleFile(path);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
    },
    [flatRows, selectedIndex, viewAsTree, fileEntries, collapsedFiles, fileMatchesMap, toggleFile, onOpenFile, onClose],
  );

  // Auto-scroll virtualizer to selected item (only on keyboard nav)
  useEffect(() => {
    if (selectedIndex >= 0 && !viewAsTree && keyboardNavRef.current) {
      keyboardNavRef.current = false;
      virtualizer.scrollToIndex(selectedIndex, { align: "center" });
    }
  }, [selectedIndex, viewAsTree, virtualizer]);

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

  // ── Custom event listeners for global search shortcuts ──

  useEffect(() => {
    function handler() {
      setMatchCase((v) => !v);
      requery();
    }
    window.addEventListener("vibe:search-toggle-match-case", handler);
    return () => window.removeEventListener("vibe:search-toggle-match-case", handler);
  }, [requery]);

  useEffect(() => {
    function handler() {
      setMatchWholeWord((v) => !v);
      requery();
    }
    window.addEventListener("vibe:search-toggle-whole-word", handler);
    return () => window.removeEventListener("vibe:search-toggle-whole-word", handler);
  }, [requery]);

  useEffect(() => {
    function handler() {
      setUseRegex((v) => !v);
      scheduleSearch(query);
    }
    window.addEventListener("vibe:search-toggle-regex", handler);
    return () => window.removeEventListener("vibe:search-toggle-regex", handler);
  }, [query, scheduleSearch]);

  useEffect(() => {
    function handler() {
      setReplaceOpen((v) => !v);
    }
    window.addEventListener("vibe:search-toggle-replace", handler);
    return () => window.removeEventListener("vibe:search-toggle-replace", handler);
  }, []);

  useEffect(() => {
    function handler() {
      setShowFilters((v) => !v);
    }
    window.addEventListener("vibe:search-toggle-filters", handler);
    return () => window.removeEventListener("vibe:search-toggle-filters", handler);
  }, []);

  useEffect(() => {
    function handler() {
      setViewAsTree((v) => !v);
    }
    window.addEventListener("vibe:search-toggle-tree", handler);
    return () => window.removeEventListener("vibe:search-toggle-tree", handler);
  }, []);

  useEffect(() => {
    function handler() {
      handleRefresh();
    }
    window.addEventListener("vibe:search-refresh", handler);
    return () => window.removeEventListener("vibe:search-refresh", handler);
  }, [handleRefresh]);

  useEffect(() => {
    function handler() {
      handleClear();
    }
    window.addEventListener("vibe:search-clear", handler);
    return () => window.removeEventListener("vibe:search-clear", handler);
  }, [handleClear]);

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
              onClick={() => {
                onOpenFile(m.path, m.line, m.column, committedQueryRef.current.query.length);
                onClose();
              }}
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
      isSelected,
      onOpenFile,
    }: {
      m: ContentMatch;
      lang: string;
      isLastMatch: boolean;
      isSelected: boolean;
      onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
      onClose: () => void;
    }) => {
      const { query: cq, matchCase: cmc } = committedQueryRef.current;
      return (
        <div
          className={`sc-match-row${isLastMatch ? " sc-match-row--last" : ""}${isSelected ? " sc-match-row--selected" : ""}`}
          onClick={() => {
            onOpenFile(m.path, m.line, m.column, cq.length);
            onClose();
          }}
        >
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
          prev.isLastMatch === next.isLastMatch &&
          prev.isSelected === next.isSelected,
      ),
    [MatchRow],
  );

  return (
    <div className="search-code" ref={containerRef} onKeyDown={handleKeyDown}>
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
                  onKeyDown={handleInputKeyDown}
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
                    <div
                      className={
                        "sc-file-header" + (virtualRow.index === selectedIndex ? " sc-file-header--selected" : "")
                      }
                      onClick={() => toggleFile(entry.path)}
                      onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                    >
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
                    className={"sc-match-row" + (virtualRow.index === selectedIndex ? " sc-match-row--selected" : "")}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                      paddingLeft: 32,
                      color: "var(--fg-muted)",
                    }}
                    onMouseEnter={() => setSelectedIndex(virtualRow.index)}
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
                    className={
                      "sc-match-row sc-match-row--last" +
                      (virtualRow.index === selectedIndex ? " sc-match-row--selected" : "")
                    }
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
                    onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                  >
                    {t("moreMatches", { count: String(fm.total - 200) })}
                  </div>
                );
              }
              const m = fm.matches[row.matchIndex];
              if (!m) return null;
              const isLastMatch = row.matchIndex === fm.matches.length - 1 || row.matchIndex === 199;
              const lang = getLanguageFromFilename(entry.name);
              const isSelected = virtualRow.index === selectedIndex;
              return (
                <div
                  key={row.key}
                  className={isSelected ? "sc-match-row--selected-wrapper" : ""}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  onMouseEnter={() => setSelectedIndex(virtualRow.index)}
                >
                  {row.matchIndex < 200 ? (
                    <MatchRowMemo
                      m={m}
                      lang={lang}
                      isLastMatch={isLastMatch}
                      isSelected={isSelected}
                      onOpenFile={onOpenFile}
                      onClose={onClose}
                    />
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
