import type { HistoryItem, TodoTask, TodoCheckpoint } from "./types.js";
import { basename } from "./utils.js";

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
    case "edit_file":
    case "write_file":
      return file ? t("activityUpdateFile", { name: file }) : t("activityUpdateCode");
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
  "search" | "read" | "edit" | "command" | "browse" | "agent" | "git" | "todo" | "external" | "tool";

export function toolActivityKind(item: HistoryItem): ToolActivityKind {
  if (item.toolName?.startsWith("git_")) return "git";
  switch (item.toolName) {
    case "search_codebase":
    case "grep_search":
      return "search";
    case "read_file":
    case "view_file":
      return "read";
    case "edit_file":
    case "write_file":
      return "edit";
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
  external: "activityGroupExternal",
  tool: "activityGroupTools",
};

export function summarizeToolActivities(items: HistoryItem[], t: Translate): string {
  const kinds = [...new Set(items.map(toolActivityKind))];
  const labels = kinds.map((kind) => t(TOOL_ACTIVITY_LABELS[kind]));
  const last = labels.pop();
  if (!last) return t("activityGroupTools");

  const summary = labels.length === 0 ? last : `${labels.join(", ")} ${t("activityGroupAnd")} ${last}`;
  return summary.charAt(0).toLocaleUpperCase() + summary.slice(1);
}

export function isTerminalToolActivity(item: HistoryItem): boolean {
  return item.kind === "tool" && (item.toolName === "bash" || item.toolName === "run_command");
}

/**
 * Collect tool calls into activity accordions without letting the assistant's
 * interleaved reasoning split every call into its own group. Terminal calls
 * get their own group so a burst of commands does not fill the timeline.
 */
export function groupToolActivities(items: HistoryItem[]): HistoryItem[][] {
  const groups: HistoryItem[][] = [];
  let group: HistoryItem[] = [];
  let groupIsTerminal = false;

  const flush = () => {
    if (group.length === 0) return;
    groups.push(group);
    group = [];
  };

  for (const item of items) {
    if (item.kind !== "tool" || item.toolName === "todo") continue;
    const isTerminal = isTerminalToolActivity(item);
    if (group.length > 0 && isTerminal !== groupIsTerminal) {
      flush();
    }
    groupIsTerminal = isTerminal;
    group.push(item);
  }
  flush();

  return groups;
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
    if (
      item.kind === "assistant" &&
      (item.reasoning || item.reasoningName || (item.id !== finalItemId && item.text.trim()))
    ) {
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
