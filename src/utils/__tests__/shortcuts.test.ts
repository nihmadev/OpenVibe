import { describe, it, expect } from "vitest";
import { formatCombo, setRecording } from "../../hooks/useShortcuts";

describe("formatCombo", () => {
  it("formats simple key", () => {
    expect(formatCombo({ code: "KeyA", ctrl: false, shift: false, alt: false })).toBe("A");
  });

  it("formats Ctrl+key", () => {
    expect(formatCombo({ code: "KeyS", ctrl: true, shift: false, alt: false })).toBe("Ctrl+S");
  });

  it("formats Ctrl+Shift+key", () => {
    expect(formatCombo({ code: "KeyP", ctrl: true, shift: true, alt: false })).toBe("Ctrl+Shift+P");
  });

  it("formats Alt+key", () => {
    expect(formatCombo({ code: "Digit1", ctrl: false, shift: false, alt: true })).toBe("Alt+1");
  });

  it("formats all modifiers", () => {
    expect(formatCombo({ code: "KeyX", ctrl: true, shift: true, alt: true })).toBe("Ctrl+Alt+Shift+X");
  });

  it("maps special codes", () => {
    expect(formatCombo({ code: "Comma", ctrl: true, shift: false, alt: false })).toBe("Ctrl+,");
    expect(formatCombo({ code: "Space", ctrl: false, shift: false, alt: false })).toBe("Space");
    expect(formatCombo({ code: "Tab", ctrl: false, shift: false, alt: false })).toBe("Tab");
    expect(formatCombo({ code: "Enter", ctrl: false, shift: false, alt: false })).toBe("Enter");
    expect(formatCombo({ code: "Escape", ctrl: false, shift: false, alt: false })).toBe("Esc");
    expect(formatCombo({ code: "ArrowUp", ctrl: false, shift: false, alt: false })).toBe("\u2191");
    expect(formatCombo({ code: "ArrowDown", ctrl: false, shift: false, alt: false })).toBe("\u2193");
    expect(formatCombo({ code: "ArrowLeft", ctrl: false, shift: false, alt: false })).toBe("\u2190");
    expect(formatCombo({ code: "ArrowRight", ctrl: false, shift: false, alt: false })).toBe("\u2192");
    expect(formatCombo({ code: "BracketLeft", ctrl: true, shift: false, alt: false })).toBe("Ctrl+[");
    expect(formatCombo({ code: "BracketRight", ctrl: true, shift: false, alt: false })).toBe("Ctrl+]");
    expect(formatCombo({ code: "Backquote", ctrl: true, shift: false, alt: false })).toBe("Ctrl+`");
  });
});

describe("setRecording", () => {
  it("is a function that can be called", () => {
    expect(typeof setRecording).toBe("function");
    expect(() => setRecording("test-id")).not.toThrow();
    expect(() => setRecording(null)).not.toThrow();
  });
});
