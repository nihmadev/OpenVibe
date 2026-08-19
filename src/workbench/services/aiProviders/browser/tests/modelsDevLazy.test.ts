import { afterEach, describe, expect, it, vi } from "vitest";

const catalogImports = vi.hoisted(() => ({ count: 0 }));

vi.mock("../../data/modelsDevCatalog.json", () => {
  catalogImports.count += 1;
  return {
    default: {
      openai: { id: "openai", name: "OpenAI", models: {} },
    },
  };
});

describe("models.dev lazy catalog", () => {
  afterEach(() => vi.useRealTimers());

  it("does not import the bundled catalog until initialization and deduplicates initialization", async () => {
    vi.useFakeTimers();
    vi.resetModules();
    catalogImports.count = 0;

    const { modelsDevService } = await import("../modelsDevService");
    expect(catalogImports.count).toBe(0);

    const [first, second] = await Promise.all([modelsDevService.initialize(), modelsDevService.initialize()]);

    expect(catalogImports.count).toBe(1);
    expect(first).toBe(second);
    expect(first.openai?.name).toBe("OpenAI");
  });
});
