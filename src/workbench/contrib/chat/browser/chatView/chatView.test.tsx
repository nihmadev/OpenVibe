import { render, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { HistoryItem } from "../../common/chat";
import { ChatView } from "./chatView";

vi.mock("@/platform/storage/common/keyValueStore", () => ({
  appState: { get: vi.fn(async () => null) },
}));

describe("ChatView virtualization", () => {
  const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
  const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get() {
        return (this as HTMLElement).classList.contains("chathistory-container") ? 600 : 220;
      },
    });
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 800 });
  });

  afterAll(() => {
    if (originalOffsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
    if (originalOffsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
  });

  it("keeps a 1000-entry history bounded to the viewport and overscan", async () => {
    const items: HistoryItem[] = Array.from({ length: 1000 }, (_, index) => ({
      id: `message-${index}`,
      kind: "user",
      text: `Message ${index}`,
    }));

    const { container } = render(<ChatView items={items} />);

    await waitFor(() => {
      const mountedEntries = container.querySelectorAll(".chathistory-virtual-entry");
      expect(mountedEntries.length).toBeGreaterThan(0);
      expect(mountedEntries.length).toBeLessThan(20);
    });
    expect(container.querySelectorAll("[data-chat-entry-id]").length).toBeLessThan(20);
  });

  it("keeps the active streaming run mounted outside the visible range", async () => {
    const items: HistoryItem[] = Array.from({ length: 200 }, (_, index) => ({
      id: `message-${index}`,
      kind: "user",
      text: `Message ${index}`,
    }));
    items.push({ id: "active-run", kind: "assistant", text: "Streaming" });

    const { container } = render(<ChatView items={items} busy streamingId="active-run" />);

    await waitFor(() => {
      expect(container.querySelector('[data-chat-entry-id="active-run"]')).not.toBeNull();
    });
    expect(container.querySelectorAll(".chathistory-virtual-entry").length).toBeLessThan(22);
  });
});
