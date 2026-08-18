import { describe, expect, it } from "vitest";
import { escapeHtml } from "../string";

describe("escapeHtml", () => {
  it("returns empty string for falsy input", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes & and < characters", () => {
    expect(escapeHtml("<div>a&b</div>")).toBe("&lt;div>a&amp;b&lt;/div>");
  });

  it("passes through plain text", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});
