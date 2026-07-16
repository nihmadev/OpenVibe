import { describe, it, expect } from "vitest";
import { PROVIDER_TEMPLATES, getProviderIconPath } from "../../constants";

describe("PROVIDER_TEMPLATES", () => {
  it("contains expected providers", () => {
    const ids = PROVIDER_TEMPLATES.map((p) => p.id);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("openai");
    expect(ids).toContain("google");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("ollama");
  });

  it("each provider has required fields", () => {
    for (const p of PROVIDER_TEMPLATES) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.baseUrl).toBeTruthy();
      expect(p.icon).toMatch(/\.(svg|webp)$/);
    }
  });

  it("has unique IDs", () => {
    const ids = PROVIDER_TEMPLATES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getProviderIconPath", () => {
  it("returns plain icon path for non-dark provider in light mode", () => {
    expect(getProviderIconPath("anthropic.svg", true)).toBe("icons/providers/anthropic.svg");
  });

  it("returns dark icon for known dark-themed provider in light mode", () => {
    expect(getProviderIconPath("openai.svg", true)).toBe("icons/providers/openai-dark.svg");
    expect(getProviderIconPath("ollama.svg", true)).toBe("icons/providers/ollama-dark.svg");
    expect(getProviderIconPath("github.svg", true)).toBe("icons/providers/github-dark.svg");
  });

  it("returns plain icon for non-dark provider in dark mode", () => {
    expect(getProviderIconPath("anthropic.svg", false)).toBe("icons/providers/anthropic.svg");
  });

  it("returns plain icon for dark provider in dark mode", () => {
    expect(getProviderIconPath("openai.svg", false)).toBe("icons/providers/openai.svg");
  });
});
