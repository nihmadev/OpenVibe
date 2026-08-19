import { describe, expect, it } from "vitest";
import { basename, IMAGE_RE, newAttachId } from "../composerUtils";
import { createTextFragment, readEditorParts, removeTrailingOrphanBreak, selectEditorText } from "../utils/editorDom";
import { modelDisplayName } from "../utils/modelDisplay";

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

describe("readEditorParts", () => {
  it("preserves pasted Markdown line breaks represented by br elements", () => {
    const editor = document.createElement("div");
    editor.appendChild(createTextFragment("# Heading\n\n- first\n- second\n\n---\n\n```ts\nconst ok = true;\n```"));

    expect(readEditorParts(editor)).toEqual([
      {
        type: "text",
        content: "# Heading\n\n- first\n- second\n\n---\n\n```ts\nconst ok = true;\n```",
      },
    ]);
  });

  it("returns empty text content when DOM contains only orphan br or empty spans left by browser backspace", () => {
    const editor = document.createElement("div");
    const br = document.createElement("br");
    editor.appendChild(br);

    expect(readEditorParts(editor)).toEqual([
      {
        type: "text",
        content: "",
      },
    ]);

    const emptySpan = document.createElement("span");
    emptySpan.appendChild(document.createElement("br"));
    const editor2 = document.createElement("div");
    editor2.appendChild(emptySpan);

    expect(readEditorParts(editor2)).toEqual([
      {
        type: "text",
        content: "",
      },
    ]);
  });
});

describe("removeTrailingOrphanBreak", () => {
  it("removes a browser-created trailing break after a pill", () => {
    const editor = document.createElement("div");
    const pill = document.createElement("span");
    pill.dataset.type = "file";
    editor.append(pill, document.createElement("br"));

    removeTrailingOrphanBreak(editor);

    expect(editor.lastChild).toBe(pill);
  });

  it("keeps a controlled break with its zero-width marker", () => {
    const editor = document.createElement("div");
    const pill = document.createElement("span");
    pill.dataset.type = "file";
    const marker = document.createTextNode("\u200B");
    editor.append(pill, document.createElement("br"), marker);

    removeTrailingOrphanBreak(editor);

    expect(editor.childNodes).toHaveLength(3);
  });
});

describe("modelDisplayName", () => {
  it("removes a redundant provider prefix", () => {
    expect(modelDisplayName("OpenAI: GPT 5.6 Sol")).toBe("GPT 5.6 Sol");
    expect(modelDisplayName("  OpenRouter: Claude Sonnet 4.5  ")).toBe("Claude Sonnet 4.5");
  });

  it("keeps model ids and names without a provider prefix", () => {
    expect(modelDisplayName("openai/gpt-5.6-sol")).toBe("openai/gpt-5.6-sol");
    expect(modelDisplayName("GPT 5.6 Sol")).toBe("GPT 5.6 Sol");
  });
});

describe("selectEditorText", () => {
  it("ends the full selection in the last text node instead of the block root", () => {
    const editor = document.createElement("div");
    editor.append("short text");
    document.body.append(editor);

    expect(selectEditorText(editor)).toBe(true);
    const range = window.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(editor.firstChild);
    expect(range?.startOffset).toBe(0);
    expect(range?.endContainer).toBe(editor.lastChild);
    expect(range?.endOffset).toBe("short text".length);

    editor.remove();
  });
});
