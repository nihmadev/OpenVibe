import { describe, it, expect } from "vitest";
import { newAttachId, basename, IMAGE_RE } from "../../components/prompt-input/utils";

describe("newAttachId", () => {
  it("generates ID with a prefix and timestamp", () => {
    const id = newAttachId();
    expect(id).toMatch(/^a\d+-[0-9a-z]+$/);
  });

  it("generates sequential IDs", () => {
    const id1 = newAttachId();
    const id2 = newAttachId();
    expect(id1).not.toBe(id2);
  });
});

describe("basename", () => {
  it("extracts name from Unix path", () => {
    expect(basename("/path/to/file.txt")).toBe("file.txt");
  });

  it("extracts name from Windows path", () => {
    expect(basename("C:\\path\\to\\file.txt")).toBe("file.txt");
  });

  it("returns input when no separator", () => {
    expect(basename("file.txt")).toBe("file.txt");
  });

  it("handles trailing slash", () => {
    expect(basename("/path/to/")).toBe("/path/to/");
  });
});

describe("IMAGE_RE", () => {
  it("matches common image extensions", () => {
    expect(IMAGE_RE.test("photo.png")).toBe(true);
    expect(IMAGE_RE.test("photo.jpg")).toBe(true);
    expect(IMAGE_RE.test("photo.jpeg")).toBe(true);
    expect(IMAGE_RE.test("photo.gif")).toBe(true);
    expect(IMAGE_RE.test("photo.webp")).toBe(true);
    expect(IMAGE_RE.test("photo.bmp")).toBe(true);
    expect(IMAGE_RE.test("photo.svg")).toBe(true);
  });

  it("does not match non-image extensions", () => {
    expect(IMAGE_RE.test("file.txt")).toBe(false);
    expect(IMAGE_RE.test("file.pdf")).toBe(false);
    expect(IMAGE_RE.test("file.ts")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(IMAGE_RE.test("photo.PNG")).toBe(true);
    expect(IMAGE_RE.test("photo.JPG")).toBe(true);
  });
});
