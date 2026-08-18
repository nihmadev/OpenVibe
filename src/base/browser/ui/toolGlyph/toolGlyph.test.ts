import { describe, expect, it } from "vitest";
import { toolGlyphKind } from "./toolGlyph";

describe("toolGlyphKind", () => {
  it("uses a dedicated skill glyph instead of the generic tool glyph", () => {
    expect(toolGlyphKind("list_skills")).toBe("skill");
    expect(toolGlyphKind("read_skill")).toBe("skill");
    expect(toolGlyphKind("read_skill_resource")).toBe("skill");
    expect(toolGlyphKind("browser_snapshot")).toBe("web");
  });
});
