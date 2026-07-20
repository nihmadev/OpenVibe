import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { StreamingMarkdown } from "../StreamingMarkdown.js";

// StreamingMarkdown reads a persisted setting on mount via window.vibe.
beforeEach(() => {
  (window as unknown as { vibe: unknown }).vibe = {
    state: { get: () => Promise.resolve(null) },
  };
});

describe("StreamingMarkdown key stability", () => {
  it("reconciles the same <p> node in place as content streams in", () => {
    const { container, rerender } = render(<StreamingMarkdown content="Hello" isAssistant />);
    const first = container.querySelector("p");
    expect(first).toBeTruthy();

    rerender(<StreamingMarkdown content="Hello world" isAssistant />);
    const second = container.querySelector("p");

    // With deterministic keys React keeps the DOM node; with the old
    // global-counter keys it would mount a brand-new element each frame.
    expect(second).toBe(first);
    expect(second?.textContent).toContain("Hello world");
  });

  it("keeps earlier paragraphs stable when a new paragraph is appended", () => {
    const { container, rerender } = render(<StreamingMarkdown content={"First para\n\nSecond"} isAssistant />);
    const firstBefore = container.querySelectorAll("p")[0];

    rerender(<StreamingMarkdown content={"First para\n\nSecond para\n\nThird"} isAssistant />);
    const firstAfter = container.querySelectorAll("p")[0];

    expect(firstAfter).toBe(firstBefore);
    expect(firstAfter?.textContent).toContain("First para");
  });
});
