import { HistoryItem } from "./types";

export interface FileBadgeInfo {
  name: string;
  ext: string;
  cls: string;
  rawPath?: string;
}

export const EXT_COLORS: Record<string, string> = {
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

export function basename(p: string): string {
  const m = /[\\/]([^\\/]+)$/.exec(p);
  return m?.[1] ?? p;
}

export function pickFile(args: unknown): FileBadgeInfo | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  const raw = typeof a.path === "string" ? a.path : typeof a.file === "string" ? a.file : null;
  if (!raw) return null;
  const name = basename(raw);
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
  return { name, ext, cls: EXT_COLORS[ext] ?? "", rawPath: raw };
}

export function toRelativePath(filePath: string, cwd?: string): string {
  if (!cwd) return filePath;
  const np = filePath.replace(/\\/g, "/").replace(/\/$/, "");
  const nc = cwd.replace(/\\/g, "/").replace(/\/$/, "");
  if (np.startsWith(nc + "/")) return np.slice(nc.length + 1);
  if (np === nc) return ".";
  return filePath;
}

type TranslateFn = (key: string, params?: Record<string, string>) => string;

export function describe(
  item: HistoryItem,
  t: TranslateFn,
  cwd?: string,
): { verb: string; file: FileBadgeInfo | null; suffix: string } {
  const file = pickFile(item.toolArgs);
  if (file && cwd && file.rawPath) {
    file.rawPath = toRelativePath(file.rawPath, cwd);
  }
  const pending = item.ok === undefined;
  switch (item.toolName) {
    case "read_file":
      return { verb: pending ? t("reading") : t("read"), file, suffix: "" };
    case "write_file":
      return {
        verb: item.ok === false ? t("failedWrite") : pending ? t("writing") : t("edited"),
        file,
        suffix: "",
      };
    case "edit_file":
      return {
        verb: item.ok === false ? t("failedEdit") : pending ? t("editing") : t("edited"),
        file,
        suffix: "",
      };
    case "list_dir": {
      const args = item.toolArgs as { path?: string } | undefined;
      const path = args?.path ?? ".";
      return {
        verb: pending ? t("listing") : t("listed"),
        file: { name: basename(path) || path, ext: "", cls: "dir", rawPath: path },
        suffix: "",
      };
    }
    case "search_codebase": {
      const args = item.toolArgs as { query?: string } | undefined;
      const text = args?.query ?? "";
      return {
        verb: pending ? t("searchingCodebase") : t("searchedCodebase"),
        file: null,
        suffix: text ? `"${text}"` : "",
      };
    }
    case "bash": {
      const args = item.toolArgs as { command?: string } | undefined;
      return {
        verb: pending ? t("running") : t("ran"),
        file: null,
        suffix: args?.command ?? "",
      };
    }
    case "agent": {
      const args = item.toolArgs as { task?: string } | undefined;
      return {
        verb: pending ? t("exploring") : t("explored"),
        file: null,
        suffix: args?.task ?? "",
      };
    }
    default: {
      if (item.toolName?.startsWith("mcp__")) {
        const parts = item.toolName.split("__");
        const serverName = parts[1] || "mcp";
        const toolName = parts.slice(2).join("__");
        const verb = t("mcpCall");
        return {
          verb,
          file: null,
          suffix: `[${serverName}] ${toolName}`,
        };
      }
      return { verb: item.toolName ?? t("tool"), file, suffix: "" };
    }

  }
}

export const ICON_MAP_HISTORY: Record<string, string> = {
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

export function formatArgs(args: unknown): string {
  try {
    const s = JSON.stringify(args);
    return s.length > 200 ? s.slice(0, 200) + "…" : s;
  } catch {
    return "";
  }
}
