import type { ContentMatch } from "../../../types.js";
import { compactFolderTree } from "../../../utils/paths.js";

export interface FileGroup {
  path: string;
  rel: string;
  name: string;
  matchCount?: number;
  matches: ContentMatch[];
}

export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  relDir: string;
  children: TreeNode[];
  matchesCount: number;
  matches: ContentMatch[];
  filePath?: string;
}

export interface FileGroupEntry {
  path: string;
  rel: string;
  name: string;
  matchCount: number;
}

export type FlatRow =
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
      matchesCount: group.matchCount ?? group.matches.length,
      matches: group.matches,
      filePath: group.path,
    };
    if (dirPath) {
      const parent = getOrCreateDir(dirPath);
      parent.children.push(fileNode);
      let curr: string | undefined = dirPath;
      while (curr) {
        const d = dirMap.get(curr);
        if (d) d.matchesCount += fileNode.matchesCount;
        const p = curr.split("/").slice(0, -1).join("/");
        curr = p || undefined;
      }
    } else {
      rootNodes.push(fileNode);
    }
  }

  return compactFolderTree(sortNodes(rootNodes));
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

export function computeFlatRows(
  fileEntries: FileGroupEntry[],
  collapsedFiles: Set<string>,
  fileMatchesMap: Record<string, { matches: ContentMatch[]; total: number }>,
): FlatRow[] {
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
}

export function computeTreeNodes(
  fileEntries: FileGroupEntry[],
  fileMatchesMap: Record<string, { matches: ContentMatch[]; total: number }>,
): TreeNode[] {
  const groups: FileGroup[] = fileEntries.map((entry) => ({
    path: entry.path,
    rel: entry.rel,
    name: entry.name,
    matchCount: entry.matchCount,
    matches: fileMatchesMap[entry.path]?.matches ?? [],
  }));
  return buildTree(groups);
}
