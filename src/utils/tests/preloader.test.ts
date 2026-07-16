import { describe, it, expect, vi, beforeEach } from "vitest";

describe("preloader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("preloadCommonIcons creates Image for each file and folder icon", async () => {
    const images: string[] = [];
    const origImage = globalThis.Image;
    (globalThis as any).Image = class MockImage {
      src = "";
      constructor() {
        images.push("ctor");
      }
    };

    const { preloadCommonIcons } = await import("../preloader");
    preloadCommonIcons();

    // 15 file icons + 9 folder icons = 24
    expect(images.length).toBe(24);

    globalThis.Image = origImage;
  });

  it("preloadAll calls preloadCommonIcons and loader.init", async () => {
    const { preloadAll } = await import("../preloader");
    const { loader } = await import("@monaco-editor/react");

    const initSpy = vi.spyOn(loader, "init").mockResolvedValue(undefined as any);

    // no error expected
    expect(() => preloadAll()).not.toThrow();

    expect(initSpy).toHaveBeenCalledOnce();
  });
});
