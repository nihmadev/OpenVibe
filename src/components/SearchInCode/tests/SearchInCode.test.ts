import { describe, it, expect } from "vitest";
import { tokenizeLine, syntaxHighlightLine, getLanguageFromFilename, LRU } from "../../../utils/searchSyntax.js";
import {
  globToRegex,
  matchesGlob,
  filterResults,
  groupByFile,
  buildTree,
  sortNodes,
  computeTreeNodes,
} from "../utils/searchTreeUtils.js";
import type { ContentMatch } from "../../../types.js";

// ── LRU cache ──

describe("LRU", () => {
  it("stores and retrieves values", () => {
    const cache = new LRU<string, number>(5);
    cache.set("a", 1);
    expect(cache.get("a")).toBe(1);
  });

  it("returns undefined for missing keys", () => {
    const cache = new LRU<string, number>(5);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("evicts oldest when over capacity", () => {
    const cache = new LRU<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  it("promotes accessed keys", () => {
    const cache = new LRU<string, number>(2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.get("a"); // promote 'a'
    cache.set("c", 3);
    expect(cache.get("a")).toBe(1); // 'a' was accessed, 'b' should be evicted
    expect(cache.get("b")).toBeUndefined();
  });
});

// ── getLanguageFromFilename ──

describe("getLanguageFromFilename", () => {
  it("detects TypeScript", () => {
    expect(getLanguageFromFilename("main.ts")).toBe("ts");
    expect(getLanguageFromFilename("component.tsx")).toBe("ts");
  });

  it("detects JavaScript", () => {
    expect(getLanguageFromFilename("app.js")).toBe("js");
    expect(getLanguageFromFilename("module.mjs")).toBe("js");
  });

  it("detects Rust", () => {
    expect(getLanguageFromFilename("main.rs")).toBe("rs");
  });

  it("detects Python", () => {
    expect(getLanguageFromFilename("script.py")).toBe("py");
  });

  it("returns empty string for unknown extensions", () => {
    expect(getLanguageFromFilename("readme.md")).toBe("");
    expect(getLanguageFromFilename("Makefile")).toBe("");
    expect(getLanguageFromFilename("Dockerfile")).toBe("");
  });

  it("handles cyrillic filenames", () => {
    expect(getLanguageFromFilename("файл.ts")).toBe("ts");
    expect(getLanguageFromFilename("скрипт.py")).toBe("py");
  });

  it("handles files without extension", () => {
    expect(getLanguageFromFilename("docker-compose")).toBe("");
  });
});

// ── tokenizeLine ──

describe("tokenizeLine", () => {
  it("tokenizes keywords and identifiers in Rust", () => {
    const tokens = tokenizeLine("let x = 42;", "rs");
    expect(tokens.some((t) => t.text === "let" && t.className === "sc-token-keyword")).toBe(true);
    expect(tokens.some((t) => t.text === "x" && t.className === "sc-token-identifier")).toBe(true);
    expect(tokens.some((t) => t.text === "42" && t.className === "sc-token-number")).toBe(true);
  });

  it("tokenizes string literals", () => {
    const tokens = tokenizeLine('const s = "hello world";', "ts");
    expect(tokens.some((t) => t.text === '"hello world"' && t.className === "sc-token-string")).toBe(true);
  });

  it("tokenizes strings with cyrillic content", () => {
    const tokens = tokenizeLine('const s = "Привет, мир!";', "ts");
    expect(tokens.some((t) => t.className === "sc-token-string")).toBe(true);
  });

  it("tokenizes strings with emoji", () => {
    const tokens = tokenizeLine('const s = "hello 🚀 world";', "ts");
    expect(tokens.some((t) => t.className === "sc-token-string")).toBe(true);
  });

  it("tokenizes comments", () => {
    const tokens = tokenizeLine("// это комментарий на русском", "ts");
    expect(tokens.some((t) => t.className === "sc-token-comment")).toBe(true);
  });

  it("handles empty line", () => {
    const tokens = tokenizeLine("", "rs");
    expect(tokens).toHaveLength(0);
  });

  it("handles whitespace-only line", () => {
    const tokens = tokenizeLine("   ", "rs");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.every((t) => t.className === "sc-token-ws")).toBe(true);
  });

  it("handles symbols and punctuation", () => {
    const tokens = tokenizeLine("=> { } [ ] ; , .", "js");
    const punctuations = tokens.filter((t) => t.className === "sc-token-punctuation");
    expect(punctuations.length).toBeGreaterThan(0);
  });

  it("tokenizes dollar sign in identifiers", () => {
    const tokens = tokenizeLine("const $el = 1;", "ts");
    expect(tokens.some((t) => t.text === "$el" && t.className === "sc-token-identifier")).toBe(true);
  });

  it("highlights keywords in TypeScript", () => {
    const tokens = tokenizeLine("async function getData<T>(): Promise<T> { return data; }", "ts");
    const keywords = tokens.filter((t) => t.className === "sc-token-keyword");
    expect(keywords.map((k) => k.text)).toContain("async");
    expect(keywords.map((k) => k.text)).toContain("function");
    expect(keywords.map((k) => k.text)).toContain("return");
  });
});

// ── syntaxHighlightLine ──

describe("syntaxHighlightLine", () => {
  it("highlights matching query", () => {
    const nodes = syntaxHighlightLine("foo bar foo", "", "foo", false);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("returns empty result for empty query", () => {
    const nodes = syntaxHighlightLine("hello", "rs", "", false);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("highlights cyrillic query", () => {
    const nodes = syntaxHighlightLine("Привет, мир!", "", "мир", false);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("respects case sensitivity", () => {
    const nodes = syntaxHighlightLine("Foo foo FOO", "", "foo", true);
    const spans = nodes.flatMap((n: any) => n.props?.children ?? []);
    const marks = spans.filter((s: any) => s.props?.className === "sc-match-highlight");
    expect(marks.length).toBe(1);
  });

  it("handles matches at start of line", () => {
    const nodes = syntaxHighlightLine("start here", "", "start", false);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("handles matches at end of line", () => {
    const nodes = syntaxHighlightLine("end here end", "", "end", false);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("handles special regex characters gracefully", () => {
    const nodes = syntaxHighlightLine("foo.bar[0]", "", "foo", false);
    expect(nodes.length).toBeGreaterThan(0);
  });

  it("handles dollar sign in query", () => {
    const nodes = syntaxHighlightLine("const $el = 1;", "", "$el", false);
    const spans = nodes.flatMap((n: any) => n.props?.children ?? []);
    const marks = spans.filter((s: any) => s.props?.className === "sc-match-highlight");
    expect(marks.length).toBeGreaterThan(0);
  });

  it("handles very long line", () => {
    const longLine = "x".repeat(10000);
    const nodes = syntaxHighlightLine(longLine, "", "y", false);
    expect(nodes.length).toBeGreaterThan(0);
  });
});

// ── globToRegex ──

describe("globToRegex", () => {
  it("matches simple star pattern", () => {
    const re = globToRegex("*.ts");
    expect(re.test("file.ts")).toBe(true);
    expect(re.test("file.js")).toBe(false);
    expect(re.test("dir/file.ts")).toBe(true);
  });

  it("matches double-star pattern", () => {
    const re = globToRegex("src/**/*.ts");
    expect(re.test("src/main.ts")).toBe(true);
    expect(re.test("src/sub/deep.ts")).toBe(true);
    expect(re.test("lib/main.ts")).toBe(false);
  });

  it("matches question mark pattern", () => {
    const re = globToRegex("test.?s");
    expect(re.test("test.ts")).toBe(true);
    expect(re.test("test.rs")).toBe(true);
    expect(re.test("test.tsx")).toBe(false);
  });

  it("escapes special regex characters", () => {
    const re = globToRegex("*.test.ts");
    // dot before 'test' should be literal (glob . = regex \.)
    expect(re.test("file.test.ts")).toBe(true);
    expect(re.test("fileXtest.ts")).toBe(false);
  });

  it("handles cyrillic glob patterns", () => {
    const re = globToRegex("*файл*");
    expect(re.test("мой_файл.ts")).toBe(true);
    expect(re.test("файл.ts")).toBe(true);
    expect(re.test("file.ts")).toBe(false);
  });

  it("handles patterns with brackets", () => {
    const re = globToRegex("file[0-9].txt");
    expect(re.test("file[0-9].txt")).toBe(true);
  });

  it("handles patterns with plus sign", () => {
    const re = globToRegex("file+v2.txt");
    expect(re.test("file+v2.txt")).toBe(true);
  });
});

// ── matchesGlob ──

describe("matchesGlob", () => {
  it("returns true when patterns are empty", () => {
    expect(matchesGlob("test.ts", [])).toBe(true);
  });

  it("matches against any pattern", () => {
    expect(matchesGlob("test.ts", ["*.ts", "*.js"])).toBe(true);
    expect(matchesGlob("test.js", ["*.ts", "*.js"])).toBe(true);
    expect(matchesGlob("test.py", ["*.ts", "*.js"])).toBe(false);
  });

  it("matches cyrillic paths", () => {
    expect(matchesGlob("src/файл.rs", ["*.rs"])).toBe(true);
    expect(matchesGlob("src/файл.rs", ["*.ts"])).toBe(false);
  });
});

// ── filterResults ──

describe("filterResults", () => {
  const makeMatch = (rel: string, content: string): ContentMatch => ({
    path: `/root/${rel}`,
    rel,
    name: rel.split("/").pop() ?? rel,
    line: 1,
    column: 1,
    content,
  });

  const matches = [
    makeMatch("a.ts", "Hello world"),
    makeMatch("b.rs", "fn hello()"),
    makeMatch("c.ts", "goodbye world"),
  ];

  it("filters by include glob", () => {
    const result = filterResults(matches, "Hello", false, false, false, "*.ts", "");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("a.ts");
  });

  it("filters by exclude glob", () => {
    const result = filterResults(matches, "world", false, false, false, "", "*.rs");
    expect(result).toHaveLength(2);
  });

  it("filters by content case-insensitively by default", () => {
    const result = filterResults(matches, "HELLO", false, false, false, "", "");
    expect(result).toHaveLength(2);
  });

  it("filters by content case-sensitively", () => {
    const result = filterResults(matches, "hello", true, false, false, "", "");
    expect(result).toHaveLength(1);
    // "Hello" starts with capital H
    const r2 = filterResults(matches, "Hello", true, false, false, "", "");
    expect(r2).toHaveLength(1);
  });

  it("filters by whole word", () => {
    const m = [makeMatch("a.ts", "the cat"), makeMatch("b.ts", "caterpillar"), makeMatch("c.ts", "cat")];
    const result = filterResults(m, "cat", false, true, false, "", "");
    expect(result).toHaveLength(2); // "the cat" and "cat" but not "caterpillar"
    expect(result[0].rel).toBe("a.ts");
    expect(result[1].rel).toBe("c.ts");
  });

  it("filters by regex", () => {
    const m = [makeMatch("a.ts", "cat"), makeMatch("b.ts", "cot"), makeMatch("c.ts", "cut"), makeMatch("d.ts", "dog")];
    const result = filterResults(m, "c[ou]t", false, false, true, "", "");
    expect(result).toHaveLength(2);
  });

  it("returns empty for no matches", () => {
    const result = filterResults(matches, "zzzzz", false, false, false, "", "");
    expect(result).toHaveLength(0);
  });

  it("handles cyrillic content", () => {
    const m = [makeMatch("a.ts", "Привет, мир!")];
    const result = filterResults(m, "Привет", false, false, false, "", "");
    expect(result).toHaveLength(1);
  });

  it("handles cyrillic content case-insensitive", () => {
    const m = [makeMatch("a.ts", "привет")];
    const result = filterResults(m, "ПРИВЕТ", false, false, false, "", "");
    expect(result).toHaveLength(1);
  });

  it("handles special regex chars in literal query", () => {
    const m = [makeMatch("a.ts", "foo.bar"), makeMatch("b.ts", "fooXbar")];
    const result = filterResults(m, "foo.bar", false, false, false, "", "");
    expect(result).toHaveLength(1);
  });

  it("handles large match array", () => {
    const many: ContentMatch[] = [];
    for (let i = 0; i < 10000; i++) {
      many.push(makeMatch(`file${i}.ts`, i === 9999 ? "needle" : "haystack"));
    }
    const result = filterResults(many, "needle", false, false, false, "", "");
    expect(result).toHaveLength(1);
  });

  it("combines include + exclude + content filter", () => {
    const m = [
      makeMatch("src/keep.ts", "target"),
      makeMatch("src/skip.rs", "target"),
      makeMatch("tests/keep_test.ts", "target but excluded"),
    ];
    const result = filterResults(m, "target", false, false, false, "*.ts", "*test*");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("keep.ts");
  });
});

// ── groupByFile ──

describe("groupByFile", () => {
  it("groups matches by file path", () => {
    const matches: ContentMatch[] = [
      { path: "/root/a.ts", rel: "a.ts", name: "a.ts", line: 1, column: 1, content: "foo" },
      { path: "/root/a.ts", rel: "a.ts", name: "a.ts", line: 2, column: 1, content: "bar" },
      { path: "/root/b.ts", rel: "b.ts", name: "b.ts", line: 1, column: 1, content: "baz" },
    ];
    const groups = groupByFile(matches);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.name === "a.ts")!;
    expect(a.matches).toHaveLength(2);
  });

  it("handles empty array", () => {
    const groups = groupByFile([]);
    expect(groups).toHaveLength(0);
  });

  it("handles single match", () => {
    const matches: ContentMatch[] = [
      { path: "/root/a.ts", rel: "a.ts", name: "a.ts", line: 1, column: 1, content: "foo" },
    ];
    const groups = groupByFile(matches);
    expect(groups).toHaveLength(1);
    expect(groups[0].matches).toHaveLength(1);
  });
});

// ── buildTree ──

describe("buildTree", () => {
  it("builds tree from flat file groups", () => {
    const groups = [
      { path: "/root/src/a.ts", rel: "src/a.ts", name: "a.ts", matches: [] },
      { path: "/root/src/b.ts", rel: "src/b.ts", name: "b.ts", matches: [] },
      { path: "/root/lib/c.ts", rel: "lib/c.ts", name: "c.ts", matches: [] },
    ];
    const tree = buildTree(groups);
    expect(tree).toHaveLength(2); // src/ and lib/
    const src = tree.find((n) => n.name === "src")!;
    expect(src.children).toHaveLength(2);
    expect(src.children.every((c) => !c.isDir)).toBe(true);
  });

  it("builds nested tree", () => {
    const groups = [{ path: "/root/a/b/c/d.ts", rel: "a/b/c/d.ts", name: "d.ts", matches: [] }];
    const tree = buildTree(groups);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe("a/b/c");
    expect(tree[0].path).toBe("a/b/c");
    expect(tree[0].children[0].name).toBe("d.ts");
  });

  it("handles empty groups", () => {
    const tree = buildTree([]);
    expect(tree).toHaveLength(0);
  });
});

// ── sortNodes ──

describe("sortNodes", () => {
  it("sorts directories before files", () => {
    const nodes = sortNodes([
      { name: "b.ts", path: "b.ts", isDir: false, relDir: "", children: [], matchesCount: 0, matches: [] },
      { name: "a", path: "a", isDir: true, relDir: "a", children: [], matchesCount: 0, matches: [] },
    ]);
    expect(nodes[0].isDir).toBe(true);
    expect(nodes[0].name).toBe("a");
    expect(nodes[1].name).toBe("b.ts");
  });

  it("sorts directories alphabetically", () => {
    const nodes = sortNodes([
      { name: "z", path: "z", isDir: true, relDir: "z", children: [], matchesCount: 0, matches: [] },
      { name: "a", path: "a", isDir: true, relDir: "a", children: [], matchesCount: 0, matches: [] },
    ]);
    expect(nodes[0].name).toBe("a");
    expect(nodes[1].name).toBe("z");
  });

  it("sorts files alphabetically", () => {
    const nodes = sortNodes([
      { name: "z.ts", path: "z.ts", isDir: false, relDir: "", children: [], matchesCount: 0, matches: [] },
      { name: "a.ts", path: "a.ts", isDir: false, relDir: "", children: [], matchesCount: 0, matches: [] },
    ]);
    expect(nodes[0].name).toBe("a.ts");
    expect(nodes[1].name).toBe("z.ts");
  });

  it("recursively sorts children", () => {
    const nodes = sortNodes([
      {
        name: "src",
        path: "src",
        isDir: true,
        relDir: "src",
        children: [
          { name: "z.ts", path: "src/z.ts", isDir: false, relDir: "src", children: [], matchesCount: 0, matches: [] },
          { name: "a.ts", path: "src/a.ts", isDir: false, relDir: "src", children: [], matchesCount: 0, matches: [] },
        ],
        matchesCount: 0,
        matches: [],
      },
    ]);
    expect(nodes[0].children[0].name).toBe("a.ts");
    expect(nodes[0].children[1].name).toBe("z.ts");
  });
});

// ── computeTreeNodes ──

describe("computeTreeNodes", () => {
  const fileEntries = [
    { path: "/root/src/a.ts", rel: "src/a.ts", name: "a.ts", matchCount: 2 },
    { path: "/root/src/utils/b.ts", rel: "src/utils/b.ts", name: "b.ts", matchCount: 1 },
  ];

  it("builds the file tree before individual matches are loaded", () => {
    const tree = computeTreeNodes(fileEntries, {});
    const src = tree.find((node) => node.path === "src")!;
    const file = src.children.find((node) => node.path === "src/a.ts")!;

    expect(file.name).toBe("a.ts");
    expect(file.matchesCount).toBe(2);
    expect(file.matches).toHaveLength(0);
    expect(file.filePath).toBe("/root/src/a.ts");
  });

  it("attaches loaded matches to the corresponding file", () => {
    const match: ContentMatch = {
      path: "/root/src/a.ts",
      rel: "src/a.ts",
      name: "a.ts",
      line: 4,
      column: 2,
      content: "const needle = true;",
    };
    const tree = computeTreeNodes(fileEntries, {
      "/root/src/a.ts": { matches: [match], total: 2 },
    });
    const src = tree.find((node) => node.path === "src")!;
    const file = src.children.find((node) => node.path === "src/a.ts")!;

    expect(file.matches).toEqual([match]);
    expect(file.matchesCount).toBe(2);
  });
});
