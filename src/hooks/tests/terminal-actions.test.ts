import { describe, it, expect, beforeEach } from "vitest";
import { setActiveTerminalId, getActiveTerminalId } from "../useTerminalActions";

describe("setActiveTerminalId / getActiveTerminalId", () => {
  beforeEach(() => {
    setActiveTerminalId(null);
  });

  it("returns null initially", () => {
    expect(getActiveTerminalId()).toBeNull();
  });

  it("stores and retrieves terminal ID", () => {
    setActiveTerminalId("term-1");
    expect(getActiveTerminalId()).toBe("term-1");
  });

  it("overwrites previous ID", () => {
    setActiveTerminalId("term-1");
    setActiveTerminalId("term-2");
    expect(getActiveTerminalId()).toBe("term-2");
  });

  it("clears ID when set to null", () => {
    setActiveTerminalId("term-1");
    setActiveTerminalId(null);
    expect(getActiveTerminalId()).toBeNull();
  });
});
