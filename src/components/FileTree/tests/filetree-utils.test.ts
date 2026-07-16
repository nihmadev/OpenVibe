import { describe, it, expect } from "vitest";
import { basename, dirnameOf } from "../utils";

describe("basename", () => {
  it("extracts name from Unix path", () => {
    expect(basename("/home/user/file.txt")).toBe("file.txt");
  });

  it("extracts name from Windows path", () => {
    expect(basename("C:\\Users\\user\\file.txt")).toBe("file.txt");
  });

  it("returns input when no separator", () => {
    expect(basename("file.txt")).toBe("file.txt");
  });

  it("handles trailing slash", () => {
    expect(basename("/home/user/")).toBe("user");
  });

  it("handles root path", () => {
    expect(basename("/")).toBe("/");
  });
});

describe("dirnameOf", () => {
  it("extracts dir from Unix path", () => {
    expect(dirnameOf("/home/user/file.txt")).toBe("/home/user");
  });

  it("extracts dir from Windows path", () => {
    expect(dirnameOf("C:\\Users\\user\\file.txt")).toBe("C:\\Users\\user");
  });

  it("returns input when no separator", () => {
    expect(dirnameOf("file.txt")).toBe("file.txt");
  });

  it("handles root path", () => {
    expect(dirnameOf("/")).toBe("/");
  });

  it("handles single-level path", () => {
    expect(dirnameOf("/file.txt")).toBe("");
  });
});
