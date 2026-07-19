import { describe, expect, it } from "vitest";
import type { HistoryItem, TodoTask } from "../types";
import { describe as describeTool, isMeaningfulTodoActivity } from "../utils";

const todo = (tasks: TodoTask[], previous?: TodoTask[]): HistoryItem => ({
  id: "todo",
  kind: "tool",
  text: "",
  toolName: "todo",
  toolArgs: { tasks },
  todoPreviousTasks: previous,
});

describe("todo activity feed", () => {
  const initial: TodoTask[] = [
    { id: "inspect", title: "Inspect", status: "in_progress", priority: "normal" },
    { id: "verify", title: "Verify", status: "pending", priority: "normal" },
  ];

  it("shows plan creation as a milestone", () => {
    const item = todo(initial);
    expect(isMeaningfulTodoActivity(item)).toBe(true);
    expect(describeTool(item).verb).toBe("Created task plan");
  });

  it("hides priority, reorder, add and remove churn", () => {
    expect(
      isMeaningfulTodoActivity(
        todo(
          [
            { ...initial[1]!, priority: "critical", order: 0 },
            { ...initial[0]!, order: 1 },
            { id: "extra", title: "Extra", status: "pending" },
          ],
          initial,
        ),
      ),
    ).toBe(false);
  });

  it("shows completion and blocked states with the affected task", () => {
    const completed = todo([{ ...initial[0]!, status: "completed" }, initial[1]!], initial);
    expect(isMeaningfulTodoActivity(completed)).toBe(true);
    expect(describeTool(completed)).toMatchObject({ verb: "Completed task", suffix: "Inspect" });

    const blocked = todo([initial[0]!, { ...initial[1]!, status: "waiting_user" }], initial);
    expect(isMeaningfulTodoActivity(blocked)).toBe(true);
    expect(describeTool(blocked)).toMatchObject({ verb: "Blocked on task", suffix: "Verify" });
  });
});
