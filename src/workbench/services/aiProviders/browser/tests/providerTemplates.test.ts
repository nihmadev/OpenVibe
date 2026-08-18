import { describe, expect, it } from "vitest";
import { modelsDevService } from "../modelsDevService";
import { getProviderIconPath, getProviderIconUrl, getReasoningEfforts, PROVIDER_TEMPLATES } from "../providerTemplates";

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

describe("getProviderIconPath & getProviderIconUrl", () => {
  it("returns full-color local icon path for anthropic in light and dark mode", () => {
    expect(getProviderIconPath("anthropic.svg", true)).toBe("icons/providers/anthropic.svg");
    expect(getProviderIconPath("anthropic.svg", false)).toBe("icons/providers/anthropic.svg");
  });

  it("returns dark icon for known dark-themed provider in light mode", () => {
    expect(getProviderIconPath("openai.svg", true)).toBe("icons/providers/openai-dark.svg");
    expect(getProviderIconPath("ollama.svg", true)).toBe("icons/providers/ollama-dark.svg");
    expect(getProviderIconPath("github.svg", true)).toBe("icons/providers/github-dark.svg");
  });

  it("returns full-color local icon for deepseek", () => {
    expect(getProviderIconPath("deepseek.svg", false)).toBe("icons/providers/deepseek.svg");
  });

  it("returns models.dev remote logo URL for third-party catalog providers not in local set", () => {
    expect(getProviderIconUrl("302ai")).toBe("https://models.dev/logos/302ai.svg");
  });
});

describe("modelsDevService", () => {
  it("resolves context window limit accurately", () => {
    expect(modelsDevService.getModelContextLimit("gemini-2.0-flash")).toBeGreaterThanOrEqual(1000000);
    expect(modelsDevService.getModelContextLimit("claude-3-5-sonnet")).toBe(200000);
  });

  it("resolves vision modality accurately", () => {
    expect(modelsDevService.supportsVision("gpt-4o")).toBe(true);
    expect(modelsDevService.supportsVision("claude-3-5-sonnet")).toBe(true);
  });

  it("resolves reasoning effort options", () => {
    const deepseekEfforts = getReasoningEfforts("deepseek", "deepseek-reasoner");
    expect(deepseekEfforts).toEqual(["low", "medium", "high"]);

    const o3Efforts = getReasoningEfforts("openai", "o3-mini");
    expect(o3Efforts).toEqual(["low", "medium", "high"]);
  });
});
