import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

describe("Markdown layout", () => {
  it("renders blocks directly inside a single markdown body", () => {
    const { container } = render(<Markdown content={"First paragraph\n\n> A quote\n\nLast paragraph"} isAssistant />);

    const body = container.querySelector(".markdown-body");
    expect(body?.querySelector(":scope > .markdown-body")).toBeNull();
    expect(body?.children).toHaveLength(3);
    expect(body?.children[1]?.tagName).toBe("BLOCKQUOTE");
  });

  it("places wide tables in a keyboard-scrollable container", () => {
    const content = "| Module | Purpose |\n| --- | --- |\n| `repository.rs` | A long description with `inline_code` |";
    const { container } = render(<Markdown content={content} isAssistant />);

    const scroller = container.querySelector(".markdown-table-scroll");
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller?.querySelector("table")).not.toBeNull();
  });
});
