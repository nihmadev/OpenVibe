import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePromptEditor } from "../hooks/usePromptEditor";

describe("usePromptEditor", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", { getItem: vi.fn(() => null) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reuses an inline mention node while adjacent text changes", () => {
    const { result } = renderHook(() => usePromptEditor({ t: (key) => key, onInput: vi.fn() }));
    const editor = document.createElement("div");
    result.current.editorRef.current = editor;

    act(() => {
      result.current.renderEditor([
        { type: "file", content: "@src", path: "/repo/src", isDir: true },
        { type: "text", content: " a" },
      ]);
    });

    const mention = editor.querySelector('[data-type="file"]');
    const icon = mention?.querySelector("img");

    act(() => {
      result.current.renderEditor([
        { type: "file", content: "src", path: "/repo/src", isDir: true },
        { type: "text", content: " adjacent text" },
      ]);
    });

    expect(editor.querySelector('[data-type="file"]')).toBe(mention);
    expect(editor.querySelector('[data-type="file"] img')).toBe(icon);
  });
});
