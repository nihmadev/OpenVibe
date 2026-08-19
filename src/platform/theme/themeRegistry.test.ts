import { describe, expect, it } from "vitest";
import { getThemeById, parseVSCodeTheme } from "./themeRegistry";

describe("application theme colors", () => {
  it("keeps editor palette accents out of built-in UI tokens", () => {
    const dracula = getThemeById("dracula");

    expect(dracula?.darkVars["--fg"]).toBe("#e6e6e6");
    expect(dracula?.darkVars["--accent"]).toBe("#888888");
    expect(dracula?.darkVars["--primary"]).toBe("#888888");
    expect(dracula?.darkVars["--toggle-checked"]).toBe("#888888");

    // The expressive theme colors are retained where they belong: code and
    // content syntax highlighting.
    expect(dracula?.darkVars["--syntax-keyword"]).toBe("#ff79c6");
    expect(dracula?.darkVars["--syntax-primitive"]).toBe("#50fa7b");
  });

  it("uses the same neutral UI boundary for imported VS Code themes", () => {
    const imported = parseVSCodeTheme({
      name: "Acid test",
      type: "dark",
      colors: {
        "editor.background": "#101010",
        "editor.foreground": "#62ff94",
        "button.background": "#ff00ff",
      },
    });

    expect(imported.darkVars["--fg"]).toBe("#e6e6e6");
    expect(imported.darkVars["--accent"]).toBe("#888888");
    expect(imported.darkVars["--syntax-keyword"]).toBe("#ff00ff");
    expect(imported.darkVars["--syntax-variable"]).toBe("#62ff94");
  });
});
