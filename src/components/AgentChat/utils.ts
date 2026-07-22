import { HistoryItem, TodoTask } from "./types.js";
import { basename } from "../../utils/paths.js";
export { basename };

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

export function getFilePathFromArgs(args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  const val =
    a.path ??
    a.file ??
    a.filePath ??
    a.file_path ??
    a.TargetFile ??
    a.targetFile ??
    a.target_file ??
    a.AbsolutePath ??
    a.SearchPath;
  return typeof val === "string" && val.trim() ? val : null;
}

export function getEditStrings(args: unknown): { oldStr: string; newStr: string } {
  if (!args || typeof args !== "object") return { oldStr: "", newStr: "" };
  const a = args as Record<string, unknown>;

  let oldStr =
    typeof a.old_str === "string"
      ? a.old_str
      : typeof a.TargetContent === "string"
        ? a.TargetContent
        : typeof a.oldContent === "string"
          ? a.oldContent
          : "";

  let newStr =
    typeof a.new_str === "string"
      ? a.new_str
      : typeof a.ReplacementContent === "string"
        ? a.ReplacementContent
        : typeof a.content === "string"
          ? a.content
          : typeof a.CodeContent === "string"
            ? a.CodeContent
            : typeof a.newContent === "string"
              ? a.newContent
              : "";

  if (!oldStr && !newStr && Array.isArray(a.ReplacementChunks)) {
    const chunks = a.ReplacementChunks as Array<Record<string, unknown>>;
    oldStr = chunks.map((c) => String(c.TargetContent ?? "")).join("\n");
    newStr = chunks.map((c) => String(c.ReplacementContent ?? "")).join("\n");
  }

  return { oldStr, newStr };
}

export function pickFile(args: unknown): FileBadgeInfo | null {
  const raw = getFilePathFromArgs(args);
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

type TodoActivity = { kind: "created" | "completed" | "blocked"; task?: TodoTask };

function todoActivity(item: HistoryItem): TodoActivity | null {
  const args = item.toolArgs as { tasks?: TodoTask[] } | undefined;
  const tasks = Array.isArray(args?.tasks) ? args.tasks : [];
  const previous = item.todoPreviousTasks;
  if (!previous) return tasks.length > 0 ? { kind: "created" } : null;

  const byId = (task: TodoTask) => task.id || task.title;
  const before = new Map(previous.map((task) => [byId(task), task]));
  const blocked = tasks.find((task) => {
    const oldStatus = before.get(byId(task))?.status;
    return (task.status === "blocked" || task.status === "waiting_user") && oldStatus !== task.status;
  });
  if (blocked) return { kind: "blocked", task: blocked };

  const completed = tasks.find((task) => task.status === "completed" && before.get(byId(task))?.status !== "completed");
  return completed ? { kind: "completed", task: completed } : null;
}

/** Todo updates are frequent; only milestones belong in the agent activity feed. */
export function isMeaningfulTodoActivity(item: HistoryItem): boolean {
  return item.toolName === "todo" && todoActivity(item) !== null;
}

export function describe(
  item: HistoryItem,
  cwd?: string,
  t?: (key: string, params?: Record<string, string | number | boolean>) => string,
): { verb: string; file: FileBadgeInfo | null; suffix: string } {
  const file = pickFile(item.toolArgs);
  if (file && cwd && file.rawPath) {
    file.rawPath = toRelativePath(file.rawPath, cwd);
  }
  const pending = item.ok === undefined;
  const label = (key: string, fallback: string): string => (t ? t(key) : fallback);
  switch (item.toolName) {
    case "todo": {
      const taskLabel = (task: TodoTask) => task.title.trim();
      const activity = todoActivity(item);
      if (activity?.kind === "completed" && activity.task) {
        return { verb: label("todoCompleted", "Completed task"), file: null, suffix: taskLabel(activity.task) };
      }
      if (activity?.kind === "blocked" && activity.task) {
        return { verb: label("todoBlocked", "Blocked on task"), file: null, suffix: taskLabel(activity.task) };
      }
      return { verb: label("todoCreated", "Created task plan"), file: null, suffix: "" };
    }
    case "read_file":
      return { verb: pending ? label("reading", "Reading") : label("read", "Read"), file, suffix: "" };
    case "write_file":
      return {
        verb:
          item.ok === false
            ? label("failedWrite", "Failed to write")
            : pending
              ? label("writing", "Writing")
              : label("written", "Written"),
        file,
        suffix: "",
      };
    case "edit_file":
      return {
        verb:
          item.ok === false
            ? label("failedEdit", "Failed to edit")
            : pending
              ? label("editing", "Editing")
              : label("edited", "Edited"),
        file,
        suffix: "",
      };
    case "list_dir": {
      const args = item.toolArgs as { path?: string } | undefined;
      const path = args?.path ?? ".";
      return {
        verb: pending ? label("listing", "Listing") : label("listed", "Listed"),
        file: { name: basename(path) || path, ext: "", cls: "dir", rawPath: path },
        suffix: "",
      };
    }
    case "search_codebase": {
      const args = item.toolArgs as { query?: string } | undefined;
      const text = args?.query ?? "";
      return {
        verb: pending
          ? label("searchingCodebase", "Searching in codebase")
          : label("searchedCodebase", "Search in codebase"),
        file: null,
        suffix: text ? `"${text}"` : "",
      };
    }
    case "bash": {
      const args = item.toolArgs as { command?: string } | undefined;
      return {
        verb: pending ? label("running", "Running") : label("ran", "Ran"),
        file: null,
        suffix: args?.command ?? "",
      };
    }
    case "git_status":
    case "git_branches":
    case "git_log":
    case "git_diff":
    case "git_show":
    case "git_blame":
    case "git_refs":
    case "git_merge_base":
    case "git_tree":
    case "git_grep":
    case "git_check_ignore":
    case "git_stash_list":
    case "git_reflog":
    case "git_remotes":
    case "git_worktrees":
    case "git_submodules": {
      const names: Record<string, [string, string]> = {
        git_status: ["gitStatus", "gitStatusDone"],
        git_branches: ["gitBranches", "gitBranchesDone"],
        git_log: ["gitLog", "gitLogDone"],
        git_diff: ["gitDiff", "gitDiffDone"],
        git_show: ["gitShow", "gitShowDone"],
        git_blame: ["gitBlame", "gitBlameDone"],
        git_refs: ["gitRefs", "gitRefsDone"],
        git_merge_base: ["gitInspect", "gitInspectDone"],
        git_tree: ["gitInspect", "gitInspectDone"],
        git_grep: ["gitInspect", "gitInspectDone"],
        git_check_ignore: ["gitInspect", "gitInspectDone"],
        git_stash_list: ["gitInspect", "gitInspectDone"],
        git_reflog: ["gitInspect", "gitInspectDone"],
        git_remotes: ["gitRefs", "gitRefsDone"],
        git_worktrees: ["gitInspect", "gitInspectDone"],
        git_submodules: ["gitInspect", "gitInspectDone"],
      };
      const [activeKey, doneKey] = names[item.toolName!];
      return { verb: pending ? label(activeKey, activeKey) : label(doneKey, doneKey), file: null, suffix: "" };
    }
    case "agent": {
      const args = item.toolArgs as { task?: string } | undefined;
      return {
        verb: pending ? label("exploring", "Exploring") : label("explored", "Explored"),
        file: null,
        suffix: args?.task ?? "",
      };
    }
    default: {
      if (item.toolName?.startsWith("mcp__")) {
        const parts = item.toolName.split("__");
        const serverName = parts[1] || "mcp";
        const toolName = parts.slice(2).join("__");
        return {
          verb: "MCP Call",
          file: null,
          suffix: `[${serverName}] ${toolName}`,
        };
      }
      return { verb: item.toolName ?? label("tool", "Tool"), file, suffix: "" };
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
