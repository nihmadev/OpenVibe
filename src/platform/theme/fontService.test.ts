import { describe, expect, it, vi } from "vitest";

const fontImports = vi.hoisted(() => ({ inter: 0 }));

vi.mock("@fontsource/inter/400.css", () => {
  fontImports.inter += 1;
  return {};
});

vi.mock("@/platform/storage/common/keyValueStore", () => ({
  appState: { get: vi.fn(async () => null) },
}));

import { applyFont, loadFont } from "./fontService";

describe("lazy font loading", () => {
  it("does not import a family before selection and deduplicates concurrent loads", async () => {
    expect(fontImports.inter).toBe(0);

    const [first, second] = await Promise.all([loadFont("Inter"), loadFont("Inter")]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fontImports.inter).toBe(1);
  });

  it("applies the family only after its loader succeeds", async () => {
    await applyFont("Inter", "monospace");

    expect(document.documentElement.style.getPropertyValue("--sans")).toContain('"Inter"');
    expect(document.documentElement.style.getPropertyValue("--mono")).toBe("monospace");
  });
});
