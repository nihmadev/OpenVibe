import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "@/workbench/common/conversation";
import { ReasoningBlock } from "./reasoningBlock";

describe("ReasoningBlock", () => {
  it("can be collapsed again after the user opens it", () => {
    const item = {
      id: "reasoning-1",
      kind: "assistant",
      text: "",
      reasoning: "A long reasoning summary\n\nwith several paragraphs.",
      reasoningDone: true,
    } as HistoryItem;

    const { container } = render(<ReasoningBlock item={item} isActive={false} />);
    const toggle = screen.getByRole("button");

    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAttribute("aria-label", "Свернуть");
    expect(container.querySelector(".reasoning--open")).not.toBeNull();
    expect(screen.queryByText("Свернуть")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(container.querySelector(".reasoning--open")).toBeNull();
  });
});
