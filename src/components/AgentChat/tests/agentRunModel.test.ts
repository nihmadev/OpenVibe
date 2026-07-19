import { describe, expect, it } from "vitest";
import type { HistoryItem } from "../types";
import {
  buildChatEntries,
  countRunActions,
  currentTodoTasks,
  formatRunDuration,
  getRunTiming,
  groupToolActivities,
  isTerminalToolActivity,
  summarizeToolActivities,
  toolActivityTitle,
} from "../agentRunModel";

const t = (key: string, params?: Record<string, string | number | boolean>) => {
  const labels: Record<string, string> = {
    agentRunWorking: "Working",
    activityProjectStructure: "Exploring project structure",
    activityInspectFolder: `Exploring ${params?.name}`,
    activityReadFile: `Reviewing ${params?.name}`,
    activityReadCode: "Reviewing code",
    activitySearchQuery: `Searching for ${params?.query}`,
    activitySearchCode: "Searching code",
    activityUpdateFile: `Updating ${params?.name}`,
    activityUpdateCode: "Updating code",
    activityRunCommand: "Checking project",
    activityInvestigateTask: "Investigating task",
    activityUseTool: `Running ${params?.name}`,
    activityGroupSearch: "search",
    activityGroupRead: "reading files",
    activityGroupEdit: "edited files",
    activityGroupCommand: "running commands",
    activityGroupBrowse: "browsing folders",
    activityGroupAgent: "investigation",
    activityGroupGit: "Git operations",
    activityGroupExternal: "external tools",
    activityGroupTools: "actions",
    activityGroupAnd: "and",
    tool: "Tool",
  };
  return labels[key] ?? key;
};

const item = (value: Partial<HistoryItem> & Pick<HistoryItem, "id" | "kind">): HistoryItem => ({
  text: "",
  ...value,
});

describe("buildChatEntries", () => {
  it("keeps user messages separate and combines the full agent turn", () => {
    const items = [
      item({ id: "u1", kind: "user", text: "Fix auth" }),
      item({ id: "a1", kind: "assistant", reasoning: "Inspect auth", reasoningName: "Checking auth" }),
      item({ id: "t1", kind: "tool", toolName: "read_file" }),
      item({ id: "a2", kind: "assistant", text: "Fixed." }),
      item({ id: "u2", kind: "user", text: "Thanks" }),
    ];

    const entries = buildChatEntries(items);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ kind: "single", item: { id: "u1" } });
    expect(entries[1]).toMatchObject({ kind: "run", id: "a1", finalItem: { id: "a2" } });
    expect(entries[1].kind === "run" && entries[1].items).toHaveLength(3);
    expect(entries[2]).toMatchObject({ kind: "single", item: { id: "u2" } });
  });

  it("uses only the last assistant text as the final answer", () => {
    const entries = buildChatEntries([
      item({ id: "a1", kind: "assistant", text: "intermediate" }),
      item({ id: "t1", kind: "tool", toolName: "bash" }),
      item({ id: "a2", kind: "assistant", text: "final" }),
    ]);
    expect(entries[0]).toMatchObject({ kind: "run", finalItem: { id: "a2" } });
  });
});

describe("agent run presentation", () => {
  it("derives a semantic fallback from the current tool", () => {
    const tool = item({ id: "t1", kind: "tool", toolName: "read_file", toolArgs: { path: "/app/auth.ts" } });
    expect(toolActivityTitle(tool, t)).toBe("Reviewing auth.ts");
  });

  it("counts reasoning summaries and tools as actions", () => {
    expect(
      countRunActions(
        [
          item({ id: "a1", kind: "assistant", reasoningName: "Inspecting" }),
          item({ id: "t1", kind: "tool", toolName: "read_file" }),
          item({ id: "a2", kind: "assistant", text: "answer" }),
        ],
        "a2",
      ),
    ).toBe(2);
  });

  it("does not count todo updates as visible run actions", () => {
    expect(
      countRunActions([
        item({ id: "todo-1", kind: "tool", toolName: "todo" }),
        item({ id: "t1", kind: "tool", toolName: "read_file" }),
      ]),
    ).toBe(1);
  });

  it("summarizes adjacent tool activity as a compact readable block", () => {
    expect(
      summarizeToolActivities(
        [
          item({ id: "t1", kind: "tool", toolName: "search_codebase" }),
          item({ id: "t2", kind: "tool", toolName: "read_file" }),
          item({ id: "t3", kind: "tool", toolName: "read_file" }),
        ],
        t,
      ),
    ).toBe("Search and reading files");
  });

  it("keeps regular tools in one group across interleaved reasoning", () => {
    const groups = groupToolActivities([
      item({ id: "t1", kind: "tool", toolName: "search_codebase" }),
      item({ id: "a1", kind: "assistant", reasoningName: "Inspecting matches" }),
      item({ id: "t2", kind: "tool", toolName: "read_file" }),
      item({ id: "a2", kind: "assistant", reasoningName: "Checking implementation" }),
      item({ id: "t3", kind: "tool", toolName: "edit_file" }),
    ]);

    expect(groups.map((group) => group.map((activity) => activity.id))).toEqual([["t1", "t2", "t3"]]);
  });

  it("groups terminal commands separately from regular activity", () => {
    const command = item({ id: "cmd", kind: "tool", toolName: "bash" });
    const secondCommand = item({ id: "cmd-2", kind: "tool", toolName: "run_command" });
    const groups = groupToolActivities([
      item({ id: "t1", kind: "tool", toolName: "read_file" }),
      command,
      secondCommand,
      item({ id: "t2", kind: "tool", toolName: "git_status" }),
      item({ id: "todo", kind: "tool", toolName: "todo" }),
      item({ id: "t3", kind: "tool", toolName: "write_file" }),
    ]);

    expect(isTerminalToolActivity(command)).toBe(true);
    expect(groups.map((group) => group.map((activity) => activity.id))).toEqual([
      ["t1"],
      ["cmd", "cmd-2"],
      ["t2", "t3"],
    ]);
  });

  it("gives Git tools their own activity heading", () => {
    expect(summarizeToolActivities([item({ id: "git", kind: "tool", toolName: "git_status" })], t)).toBe(
      "Git operations",
    );
  });

  it("uses persisted timing boundaries", () => {
    expect(
      getRunTiming([
        item({ id: "a1", kind: "assistant", startedAt: 1_000, completedAt: 2_000 }),
        item({ id: "t1", kind: "tool", startedAt: 2_100, completedAt: 4_500 }),
      ]),
    ).toEqual({ startedAt: 1_000, completedAt: 4_500 });
  });

  it("formats short and multi-minute durations", () => {
    expect(formatRunDuration(400)).toBe("1s");
    expect(formatRunDuration(62_000)).toBe("1m 2s");
    expect(formatRunDuration(120_000)).toBe("2m");
  });
});

describe("currentTodoTasks", () => {
  const firstPlan = {
    tasks: [
      { title: "Inspect", status: "completed" },
      { title: "Implement", status: "in_progress" },
    ],
  };

  it("returns the latest valid plan in the current user turn", () => {
    const tasks = currentTodoTasks([
      item({ id: "u1", kind: "user" }),
      item({ id: "todo-1", kind: "tool", toolName: "todo", toolArgs: firstPlan, ok: true }),
      item({
        id: "todo-2",
        kind: "tool",
        toolName: "todo",
        toolArgs: { tasks: [{ title: "Verify", status: "in_progress" }] },
      }),
    ]);

    expect(tasks).toEqual([{ title: "Verify", status: "in_progress" }]);
  });

  it("carries the latest plan into the next user turn as persistent memory", () => {
    const tasks = currentTodoTasks([
      item({ id: "u1", kind: "user" }),
      item({ id: "todo-1", kind: "tool", toolName: "todo", toolArgs: firstPlan, ok: true }),
      item({ id: "u2", kind: "user" }),
    ]);

    expect(tasks).toEqual(firstPlan.tasks);
  });
});
