import type { HistoryItem, TodoTask, TodoCheckpoint } from "./types.js";
import { basename, getFilePathFromArgs } from "./utils.js";

export type Translate = (key: string, params?: Record<string, string | number | boolean>) => string;

export type ChatEntry =
  { kind: "single"; item: HistoryItem } | { kind: "run"; id: string; items: HistoryItem[]; finalItem?: HistoryItem };

const RUN_ITEM_KINDS = new Set<HistoryItem["kind"]>(["assistant", "tool", "info", "error", "stopped"]);

function isTodoTask(value: unknown): value is TodoTask {
  if (!value || typeof value !== "object") return false;
  const task = value as Record<string, unknown>;
  return (
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    ["pending", "in_progress", "blocked", "waiting_user", "completed", "skipped"].includes(task.status as string)
  );
}

/** Return the newest valid plan in the conversation. Plans are persistent memory, not turn-local UI. */
export function currentTodoTasks(items: HistoryItem[]): TodoTask[] | null {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item?.kind !== "tool" || item.toolName !== "todo" || item.ok === false) continue;
    if (!item.toolArgs || typeof item.toolArgs !== "object") return null;
    const tasks = (item.toolArgs as Record<string, unknown>).tasks;
    if (!Array.isArray(tasks) || !tasks.every(isTodoTask)) return null;
    return tasks;
  }
  return null;
}

export function currentTodoCheckpoint(items: HistoryItem[]): TodoCheckpoint | null {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index];
    if (item?.kind !== "tool" || item.toolName !== "todo" || item.ok === false || !item.toolArgs) continue;
    const checkpoint = (item.toolArgs as Record<string, unknown>).checkpoint;
    if (!checkpoint || typeof checkpoint !== "object") return null;
    return checkpoint as TodoCheckpoint;
  }
  return null;
}

export function buildChatEntries(items: HistoryItem[]): ChatEntry[] {
  const entries: ChatEntry[] = [];
  let run: HistoryItem[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    const finalItem = [...run].reverse().find((item) => item.kind === "assistant" && item.text.trim().length > 0);
    entries.push({ kind: "run", id: run[0]!.id, items: run, finalItem });
    run = [];
  };

  for (const item of items) {
    if (RUN_ITEM_KINDS.has(item.kind)) {
      run.push(item);
      continue;
    }
    flushRun();
    entries.push({ kind: "single", item });
  }
  flushRun();
  return entries;
}

function cleanTitle(value: string): string {
  const title = value
    .replace(/\s+/g, " ")
    .replace(/[.…]+$/, "")
    .trim();
  return title.length > 96 ? `${title.slice(0, 95).trimEnd()}…` : title;
}

function stringArg(item: HistoryItem, key: string): string {
  if (!item.toolArgs || typeof item.toolArgs !== "object") return "";
  const value = (item.toolArgs as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

export function toolActivityTitle(item: HistoryItem, t: Translate): string {
  const path = stringArg(item, "path") || stringArg(item, "file");
  const file = path ? basename(path) : "";

  if (item.toolName?.startsWith("git_")) {
    const gitTool = item.toolName;
    if (gitTool === "git_status") return t("activityGitStatus");
    if (gitTool === "git_diff") return t("activityGitDiff");
    if (gitTool === "git_log") return t("activityGitLog");
    if (gitTool === "git_branches") return t("activityGitBranches");
    return t("activityGitCommand", { command: gitTool.replace("git_", "") });
  }

  switch (item.toolName) {
    case "list_dir":
      return path === "." || path === "" ? t("activityProjectStructure") : t("activityInspectFolder", { name: file });
    case "read_file":
    case "view_file":
      return file ? t("activityReadFile", { name: file }) : t("activityReadCode");
    case "search_codebase":
    case "grep_search": {
      const query = stringArg(item, "query") || stringArg(item, "pattern");
      return query ? t("activitySearchQuery", { query: cleanTitle(query) }) : t("activitySearchCode");
    }
    case "web_search": {
      const query = stringArg(item, "query");
      return query ? t("activityWebSearch", { query: cleanTitle(query) }) : t("activityWebSearchGeneral");
    }
    case "fetch_url": {
      const url = stringArg(item, "url");
      return url ? t("activityFetchUrl", { url: cleanTitle(url) }) : t("activityFetchUrlGeneral");
    }
    case "edit_file":
    case "write_file":
      return file ? t("activityUpdateFile", { name: file }) : t("activityUpdateCode");
    case "run":
    case "bash":
    case "run_command":
      return t("activityRunCommand");
    case "agent": {
      const task = stringArg(item, "task");
      return task ? cleanTitle(task) : t("activityInvestigateTask");
    }
    default:
      return t("activityUseTool", { name: item.toolName || t("tool") });
  }
}

export type ToolActivityKind =
  "search" | "read" | "edit" | "command" | "browse" | "agent" | "git" | "todo" | "web" | "external" | "tool";

export function toolActivityKind(item: HistoryItem): ToolActivityKind {
  if (item.toolName?.startsWith("git_")) return "git";
  switch (item.toolName) {
    case "search_codebase":
    case "grep_search":
      return "search";
    case "web_search":
    case "fetch_url":
      return "web";
    case "read_file":
    case "view_file":
      return "read";
    case "edit_file":
    case "write_file":
      return "edit";
    case "run":
    case "bash":
    case "run_command":
      return "command";
    case "list_dir":
      return "browse";
    case "agent":
      return "agent";
    case "todo":
      return "todo";
    default:
      return item.toolName?.startsWith("mcp__") ? "external" : "tool";
  }
}

const TOOL_ACTIVITY_LABELS: Record<ToolActivityKind, string> = {
  search: "activityGroupSearch",
  read: "activityGroupRead",
  edit: "activityGroupEdit",
  command: "activityGroupCommand",
  browse: "activityGroupBrowse",
  agent: "activityGroupAgent",
  git: "activityGroupGit",
  todo: "activityGroupTodo",
  web: "activityGroupWeb",
  external: "activityGroupExternal",
  tool: "activityGroupTools",
};

const TOOL_ACTIVITY_COUNT_LABELS: Record<ToolActivityKind, string> = {
  search: "activityGroupSearchN",
  read: "activityGroupReadN",
  edit: "activityGroupEditN",
  command: "activityGroupCommandN",
  browse: "activityGroupBrowseN",
  agent: "activityGroupAgentN",
  git: "activityGroupGitN",
  todo: "activityGroupTodoN",
  web: "activityGroupWebN",
  external: "activityGroupExternalN",
  tool: "activityGroupToolsN",
};

/**
 * Group header: "Чтение 5 файлов" / "Reading 3 files".
 * For a single item falls back to the plain kind label without a count.
 */
export function toolActivityGroupLabel(kind: ToolActivityKind, count: number, t: Translate): string {
  if (count > 1) {
    return t(TOOL_ACTIVITY_COUNT_LABELS[kind], { count });
  }
  const label = t(TOOL_ACTIVITY_LABELS[kind]);
  return label.charAt(0).toLocaleUpperCase() + label.slice(1);
}

const REASONING_BOILERPLATE = new Set([
  "Analyzing and preparing tool execution.",
  "Executing tool call.",
  "Thinking about tool call execution.",
]);

/** Reasoning worth a visible timeline row: has a name or a body beyond tool-call boilerplate. */
export function hasMeaningfulReasoning(item: HistoryItem): boolean {
  if (item.kind !== "assistant") return false;
  const body = item.reasoning?.trim();
  if (!body && !item.reasoningName) return false;
  if (body && REASONING_BOILERPLATE.has(body)) return false;
  return true;
}

/**
 * A single node in the run graph. The whole turn renders as one vertical
 * timeline (VS Code Copilot style): tool calls carry an activity icon, while
 * reasoning and narration sit on the same line as small dots.
 */
export type RunTimelineNode =
  | { type: "tool"; id: string; kind: ToolActivityKind; items: HistoryItem[] }
  | { type: "reasoning"; id: string; item: HistoryItem }
  | { type: "narration"; id: string; item: HistoryItem }
  | { type: "info"; id: string; item: HistoryItem }
  | { type: "error"; id: string; item: HistoryItem };

function isReadTool(item: HistoryItem): boolean {
  return item.toolName === "read_file" || item.toolName === "view_file";
}

/**
 * Lay the whole run out as one chronological graph. Every event is its own
 * node so the timeline reads top-to-bottom like a commit graph. Consecutive
 * reads of the same file collapse into a single node with a ×N badge.
 */
export function buildRunTimeline(items: HistoryItem[], finalItemId?: string): RunTimelineNode[] {
  const nodes: RunTimelineNode[] = [];

  for (const item of items) {
    if (item.kind === "tool") {
      // Task-list updates are rendered once above the prompt input.
      if (item.toolName === "todo") continue;
      const prev = nodes[nodes.length - 1];
      if (prev && prev.type === "tool" && isReadTool(item)) {
        const prevItem = prev.items[prev.items.length - 1]!;
        const path = getFilePathFromArgs(item.toolArgs);
        if (path && isReadTool(prevItem) && getFilePathFromArgs(prevItem.toolArgs) === path) {
          prev.items.push(item);
          continue;
        }
      }
      nodes.push({ type: "tool", id: item.id, kind: toolActivityKind(item), items: [item] });
      continue;
    }
    if (item.kind === "assistant") {
      if (hasMeaningfulReasoning(item)) {
        nodes.push({ type: "reasoning", id: item.id, item });
      }
      if (item.id !== finalItemId && item.text.trim().length > 0) {
        nodes.push({ type: "narration", id: item.id, item });
      }
      continue;
    }
    if (item.kind === "error") {
      nodes.push({ type: "error", id: item.id, item });
      continue;
    }
    if (item.kind === "info") {
      nodes.push({ type: "info", id: item.id, item });
    }
  }
  return nodes;
}

export function getRunTiming(
  items: HistoryItem[],
  allItems?: HistoryItem[],
): { startedAt?: number; completedAt?: number } {
  let startedAt: number | undefined;

  if (allItems && allItems.length > 0) {
    const firstRunItem = items[0];
    if (firstRunItem) {
      const idx = allItems.findIndex((it) => it.id === firstRunItem.id);
      if (idx > 0) {
        for (let i = idx - 1; i >= 0; i--) {
          if (allItems[i]?.kind === "user" && allItems[i]?.startedAt !== undefined) {
            startedAt = allItems[i]!.startedAt;
            break;
          }
        }
      }
    } else {
      const lastUser = [...allItems].reverse().find((it) => it.kind === "user" && it.startedAt !== undefined);
      if (lastUser) {
        startedAt = lastUser.startedAt;
      }
    }
  }

  if (!startedAt) {
    startedAt = items.find((item) => item.startedAt !== undefined)?.startedAt;
  }

  const completed = [...items].reverse().find((item) => item.completedAt !== undefined)?.completedAt;
  return { startedAt, completedAt: completed };
}

export function countRunActions(items: HistoryItem[], finalItemId?: string): number {
  return items.reduce((count, item) => {
    if (item.kind === "tool") return item.toolName === "todo" ? count : count + 1;
    if (item.kind === "assistant" && (hasMeaningfulReasoning(item) || (item.id !== finalItemId && item.text.trim()))) {
      return count + 1;
    }
    if (item.kind === "error") return count + 1;
    return count;
  }, 0);
}

export function formatRunDuration(milliseconds: number): string {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export function formatRunDurationLabel(milliseconds: number, t: Translate): string {
  const seconds = Math.max(1, Math.round(milliseconds / 1000));
  if (seconds < 60) return t("agentRunSeconds", { count: seconds });
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0
    ? t("agentRunMinutesShort", { count: minutes })
    : `${t("agentRunMinutesShort", { count: minutes })} ${t("agentRunSecondsShort", { count: rest })}`;
}
