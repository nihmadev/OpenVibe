import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { HistoryItem } from "@/workbench/common/conversation";
import { BrowserActivityGroup, localeAwareList } from "./browserActivityGroup";

describe("BrowserActivityGroup", () => {
  const items = [
    {
      id: "b1",
      kind: "tool",
      text: JSON.stringify({ action: "open", url: "https://example.com", durationMs: 20 }),
      toolName: "browser_open",
      toolArgs: { url: "https://example.com" },
      ok: true,
    },
    {
      id: "b2",
      kind: "tool",
      text: JSON.stringify({ action: "click", url: "https://example.com", target: "Continue", durationMs: 320 }),
      toolName: "browser_click",
      toolArgs: { ref: "e2" },
      ok: true,
    },
    {
      id: "b3",
      kind: "tool",
      text: JSON.stringify({ action: "fill", url: "https://example.com", target: "Search", durationMs: 80 }),
      toolName: "browser_fill",
      toolArgs: { ref: "e4", text: "secret-not-rendered" },
      ok: true,
    },
  ] as HistoryItem[];

  it("uses locale-aware list formatting and opens by clicking the entire row", () => {
    expect(localeAwareList(["one", "two", "three"], "en")).toBe("one, two, and three");
    const view = render(<BrowserActivityGroup items={items} runActive={false} />);
    const row = view.getByRole("button");
    expect(row).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(view.getAllByText("https://example.com")).toHaveLength(3);
    expect(view.queryByText("secret-not-rendered")).toBeNull();
  });

  it("shows the structured accessibility outline without depending on an image", () => {
    const snapshot = {
      id: "snapshot",
      kind: "tool",
      text: JSON.stringify({
        action: "snapshot",
        url: "https://example.com",
        result: {
          snapshot: {
            outline: ['- button "Menu" [ref=e1]', '- textbox "Search" [ref=e2] [required]'],
          },
        },
      }),
      toolName: "browser_snapshot",
      toolArgs: {},
      ok: true,
    } as HistoryItem;

    const view = render(<BrowserActivityGroup items={[snapshot]} runActive={false} />);
    fireEvent.click(view.getByRole("button"));
    expect(view.getByText(/button "Menu"/)).toHaveTextContent('textbox "Search" [ref=e2] [required]');
    expect(view.container.querySelector("img")).toBeNull();
  });
});
