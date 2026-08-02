import { describe, expect, it } from "vitest";
import { compactFolderPath, compactFolderSegments } from "../paths";

type Entry = { name: string; path: string; isDir: boolean };

describe("compactFolderPath", () => {
  it("keeps compacting when the final directory contains files", () => {
    const entries: Record<string, Entry[]> = {
      "/root": [{ name: "src", path: "/root/src", isDir: true }],
      "/root/src": [{ name: "index.ts", path: "/root/src/index.ts", isDir: false }],
    };

    const entry = { name: "root", path: "/root", isDir: true };
    expect(compactFolderPath(entry, (path) => entries[path])).toEqual({ label: "root/src/", path: "/root/src" });
    expect(compactFolderSegments(entry, (path) => entries[path]).segments).toEqual([
      { name: "root", path: "/root" },
      { name: "src", path: "/root/src" },
    ]);
  });
});
