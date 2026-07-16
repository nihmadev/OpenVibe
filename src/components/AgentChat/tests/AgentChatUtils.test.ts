import { describe as suite, it, expect } from "vitest";
import {
  EXT_COLORS,
  basename,
  pickFile,
  describe as describeItem,
  toRelativePath,
  formatArgs,
  ICON_MAP_HISTORY,
} from "../utils";
import type { HistoryItem } from "../types";

suite("EXT_COLORS", () => {
  it("has entries for common extensions", () => {
    expect(EXT_COLORS.ts).toBe("ts");
    expect(EXT_COLORS.js).toBe("js");
    expect(EXT_COLORS.py).toBe("py");
    expect(EXT_COLORS.rs).toBe("rs");
    expect(EXT_COLORS.md).toBe("md");
  });
});

suite("ICON_MAP_HISTORY", () => {
  it("maps extensions to icon filenames", () => {
    expect(ICON_MAP_HISTORY.ts).toBe("js.png");
    expect(ICON_MAP_HISTORY.py).toBe("py.png");
    expect(ICON_MAP_HISTORY.css).toBe("css.png");
    expect(ICON_MAP_HISTORY.html).toBe("html.png");
    expect(ICON_MAP_HISTORY.png).toBe("image.png");
    expect(ICON_MAP_HISTORY.svg).toBe("image.png");
  });
});

suite("basename", () => {
  it("extracts name from path", () => {
    expect(basename("/a/b/c.ts")).toBe("c.ts");
    expect(basename("C:\\a\\b\\c.ts")).toBe("c.ts");
    expect(basename("c.ts")).toBe("c.ts");
  });
});

suite("pickFile", () => {
  it("returns null for non-object input", () => {
    expect(pickFile(null)).toBeNull();
    expect(pickFile("string")).toBeNull();
    expect(pickFile(42)).toBeNull();
  });

  it("returns null when no path/file field", () => {
    expect(pickFile({})).toBeNull();
    expect(pickFile({ foo: "bar" })).toBeNull();
  });

  it("extracts file info from path field", () => {
    const result = pickFile({ path: "/home/user/main.ts" });
    expect(result).toEqual({ name: "main.ts", ext: "ts", cls: "ts", rawPath: "/home/user/main.ts" });
  });

  it("extracts file info from file field", () => {
    const result = pickFile({ file: "style.css" });
    expect(result).toEqual({ name: "style.css", ext: "css", cls: "css", rawPath: "style.css" });
  });

  it("handles extension with no color mapping", () => {
    const result = pickFile({ path: "foo.xyz" });
    expect(result).toEqual({ name: "foo.xyz", ext: "xyz", cls: "", rawPath: "foo.xyz" });
  });

  it("handles file without extension", () => {
    const result = pickFile({ path: "/dir/Makefile" });
    expect(result).toEqual({ name: "Makefile", ext: "", cls: "", rawPath: "/dir/Makefile" });
  });
});

suite("describe", () => {
  it("describes read_file (pending)", () => {
    const item = { toolName: "read_file", toolArgs: { path: "/a/b.ts" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Reading");
    expect(d.file).toEqual({ name: "b.ts", ext: "ts", cls: "ts", rawPath: "/a/b.ts" });
  });

  it("describes read_file with cwd", () => {
    const item = { toolName: "read_file", toolArgs: { path: "/home/user/proj/src/file.ts" }, ok: true } as HistoryItem;
    const d = describeItem(item, "/home/user/proj");
    expect(d.verb).toBe("Read");
    expect(d.file?.rawPath).toBe("src/file.ts");
  });

  it("describes read_file (done)", () => {
    const item = { toolName: "read_file", toolArgs: { path: "/a/b.ts" }, ok: true } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Read");
  });

  it("describes write_file (pending)", () => {
    const item = { toolName: "write_file", toolArgs: { path: "f.ts" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Writing");
  });

  it("describes write_file (failed)", () => {
    const item = { toolName: "write_file", toolArgs: { path: "f.ts" }, ok: false } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Failed to write");
  });

  it("describes edit_file", () => {
    const item = { toolName: "edit_file", toolArgs: { path: "f.ts" }, ok: true } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Edited");
  });

  it("describes list_dir (pending)", () => {
    const item = { toolName: "list_dir", toolArgs: { path: "/src" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Listing");
    expect(d.file).toEqual({ name: "src", ext: "", cls: "dir", rawPath: "/src" });
  });

  it("describes list_dir (done)", () => {
    const item = { toolName: "list_dir", toolArgs: { path: "/src" }, ok: true } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Listed");
  });

  it("describes list_dir with no path", () => {
    const item = { toolName: "list_dir" } as HistoryItem;
    const d = describeItem(item);
    expect(d.file?.name).toBe(".");
  });

  it("describes search_codebase (pending)", () => {
    const item = { toolName: "search_codebase", toolArgs: { query: "foo" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Searching in codebase");
    expect(d.suffix).toBe('"foo"');
    expect(d.file).toBeNull();
  });

  it("describes search_codebase (done)", () => {
    const item = { toolName: "search_codebase", toolArgs: { query: "foo" }, ok: true } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Search in codebase");
  });

  it("describes bash (pending)", () => {
    const item = { toolName: "bash", toolArgs: { command: "ls -la" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Running");
    expect(d.suffix).toBe("ls -la");
  });

  it("describes bash (done)", () => {
    const item = { toolName: "bash", toolArgs: { command: "ls -la" }, ok: true } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Ran");
  });

  it("describes agent (pending)", () => {
    const item = { toolName: "agent", toolArgs: { task: "find bugs" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Exploring");
    expect(d.suffix).toBe("find bugs");
  });

  it("describes agent (done)", () => {
    const item = { toolName: "agent", toolArgs: { task: "find bugs" }, ok: true } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("Explored");
  });

  it("describes unknown tool", () => {
    const item = { toolName: "custom_tool", toolArgs: { path: "x.txt" } } as HistoryItem;
    const d = describeItem(item);
    expect(d.verb).toBe("custom_tool");
    expect(d.file).toEqual({ name: "x.txt", ext: "txt", cls: "", rawPath: "x.txt" });
  });
});

suite("toRelativePath", () => {
  it("returns path unchanged when no cwd", () => {
    expect(toRelativePath("/a/b/c.ts")).toBe("/a/b/c.ts");
  });

  it("makes path relative to cwd", () => {
    expect(toRelativePath("/home/user/proj/src/file.ts", "/home/user/proj")).toBe("src/file.ts");
  });

  it("returns dot when path equals cwd", () => {
    expect(toRelativePath("/home/user/proj", "/home/user/proj")).toBe(".");
  });

  it("handles trailing slashes", () => {
    expect(toRelativePath("/home/user/proj/src/", "/home/user/proj")).toBe("src");
  });
});

suite("formatArgs", () => {
  it("returns JSON string of args", () => {
    expect(formatArgs({ a: 1, b: "hello" })).toBe('{"a":1,"b":"hello"}');
  });

  it("truncates long strings", () => {
    const long = "x".repeat(300);
    const result = formatArgs({ data: long });
    expect(result).toHaveLength(201);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns empty string for circular reference", () => {
    const obj: Record<string, unknown> = {};
    obj.self = obj;
    expect(formatArgs(obj)).toBe("");
  });
});
