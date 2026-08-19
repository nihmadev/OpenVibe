import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { HistoryItem } from "@/workbench/common/conversation";
import { AgentToolView } from "./agentToolView";

vi.mock("@/workbench/browser/parts/editor/codeBlock/codeBlock", () => ({
  CodeBlock: ({ code }: { code: string }) => <pre data-testid="tool-output">{code}</pre>,
  resolveMonacoLang: (language: string) => language,
}));

describe("AgentToolView", () => {
  it("toggles terminal output by clicking the whole action row", () => {
    const item = {
      id: "terminal-row-toggle",
      kind: "tool",
      text: "hello",
      toolName: "run",
      toolArgs: { command: "echo hello" },
      ok: true,
    } as HistoryItem;

    const { container } = render(<AgentToolView item={item} />);
    const trigger = container.querySelector<HTMLButtonElement>(".tool__row-trigger");

    expect(trigger).not.toBeNull();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger!);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(container.querySelector(".tool__diff-block")).not.toBeNull();

    fireEvent.click(trigger!);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("renders edit line counts inside the action summary", () => {
    const item = {
      id: "inline-edit-stats",
      kind: "tool",
      text: "done",
      toolName: "edit_file",
      toolArgs: {
        path: "/repo/src/app.ts",
        old_str: "one\ntwo",
        new_str: "one\ntwo\nthree",
      },
      ok: true,
    } as HistoryItem;

    const { container } = render(<AgentToolView item={item} />);
    const inlineStats = container.querySelector(".tool__diff-stats");

    expect(inlineStats).not.toBeNull();
    expect(inlineStats).toHaveTextContent("+3");
    expect(inlineStats).toHaveTextContent("−2");
    expect(inlineStats?.previousElementSibling).toHaveClass("fbadge");
  });

  it("localizes skill loading, uses a dedicated glyph, and expands from the whole row", () => {
    const item = {
      id: "read-browser-skill",
      kind: "tool",
      text: "# Browser control\n\nUse snapshot, then act.",
      toolName: "read_skill",
      toolArgs: { name: "browser-control" },
      ok: true,
    } as HistoryItem;

    const { container, getByText, getByTestId } = render(<AgentToolView item={item} />);
    expect(getByText("Получил инструкции навыка browser-control")).toBeInTheDocument();
    expect(container.querySelector(".tool-glyph--skill")).not.toBeNull();

    const trigger = container.querySelector<HTMLButtonElement>(".tool__row-trigger");
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);
    expect(getByTestId("tool-output")).toHaveTextContent("Use snapshot, then act.");
  });
});
