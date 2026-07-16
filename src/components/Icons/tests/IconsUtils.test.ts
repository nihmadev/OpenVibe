import { describe, it, expect } from "vitest";
import { getFileIcon, getLanguage, getFolderIcon } from "../utils";

describe("getFileIcon", () => {
  it("returns null for unknown extension", () => {
    expect(getFileIcon("foo.xyz")).toBeNull();
  });

  it("returns null for file with no extension", () => {
    expect(getFileIcon("Makefile")).toBeNull();
  });

  it("returns icon for known extension", () => {
    expect(getFileIcon("main.ts")).toBe("ts.svg");
    expect(getFileIcon("app.tsx")).toBe("react-ts.svg");
    expect(getFileIcon("style.css")).toBe("brackets-orange.svg");
    expect(getFileIcon("main.go")).toBe("go.svg");
  });

  it("matches full filename (case-insensitive)", () => {
    expect(getFileIcon("package.json")).toBe("npm.svg");
    expect(getFileIcon("Dockerfile")).toBe("docker.svg");
    expect(getFileIcon(".gitignore")).toBe("git.svg");
    expect(getFileIcon("vite.config.ts")).toBe("vite.svg");
  });

  it("is case-insensitive for extension", () => {
    expect(getFileIcon("Main.TS")).toBe("ts.svg");
    expect(getFileIcon("APP.JSX")).toBe("react.svg");
  });
});

describe("getLanguage", () => {
  it("returns plaintext for unknown extension", () => {
    expect(getLanguage("foo.xyz")).toBe("plaintext");
  });

  it("returns mapped language for known filenames with no extension", () => {
    expect(getLanguage("Makefile")).toBe("makefile");
  });

  it("returns language for known extension", () => {
    expect(getLanguage("main.ts")).toBe("typescript");
    expect(getLanguage("app.tsx")).toBe("typescript");
    expect(getLanguage("main.py")).toBe("python");
    expect(getLanguage("index.html")).toBe("html");
  });

  it("returns language for full filename match", () => {
    expect(getLanguage("Dockerfile")).toBe("dockerfile");
  });

  it("is case-insensitive", () => {
    expect(getLanguage("MAIN.PY")).toBe("python");
    expect(getLanguage("STYLE.CSS")).toBe("css");
  });
});

describe("getFolderIcon", () => {
  it("returns folder.svg for unknown folder", () => {
    expect(getFolderIcon("unknown", false)).toBe("folder.svg");
  });

  it("returns folder-open.svg for unknown open folder", () => {
    expect(getFolderIcon("unknown", true)).toBe("folder-open.svg");
  });

  it("returns specific icon for known closed folder", () => {
    expect(getFolderIcon("src", false)).toBe("folder-src.svg");
    expect(getFolderIcon("node_modules", false)).toBe("folder-node-modules.svg");
    expect(getFolderIcon("utils", false)).toBe("folder-utils.svg");
  });

  it("returns specific icon for known open folder", () => {
    expect(getFolderIcon("src", true)).toBe("folder-src.svg");
    expect(getFolderIcon("utils", true)).toBe("folder-utils.svg");
  });

  it("handles undefined name", () => {
    expect(getFolderIcon(undefined, false)).toBe("folder.svg");
    expect(getFolderIcon(undefined, true)).toBe("folder-open.svg");
  });

  it("is case-insensitive", () => {
    expect(getFolderIcon("SRC", false)).toBe("folder-src.svg");
    expect(getFolderIcon("Node_Modules", false)).toBe("folder-node-modules.svg");
  });
});
