import { describe, expect, it } from "vitest";
import { emitBrowserEvent, onBrowserSessionVisibility } from "./browserEventService";

describe("browser session visibility", () => {
  it("opens and closes the workbench tab only for session lifecycle events", () => {
    const visibility: boolean[] = [];
    const dispose = onBrowserSessionVisibility((open) => visibility.push(open));

    emitBrowserEvent({ type: "browser:session-started", sessionId: "session-1" });
    emitBrowserEvent({ type: "browser:loading", loading: true });
    emitBrowserEvent({ type: "browser:session-closed", sessionId: "session-1" });
    expect(visibility).toEqual([true, false]);

    dispose();
    emitBrowserEvent({ type: "browser:session-started", sessionId: "session-2" });
    expect(visibility).toEqual([true, false]);
  });
});
