import type { ThemeVars } from "../../themes/themes.js";
import type * as monaco from "monaco-editor";

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function hexToArgb(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return "#" + [r, g, b, a].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function stripHash(c: string): string {
  return c.replace("#", "");
}

export function makeMonacoTheme(vars: ThemeVars, isDark: boolean): monaco.editor.IStandaloneThemeData {
  const bg = vars["--bg"];
  const bg2 = vars["--bg-2"];
  const fg = vars["--fg"];
  const line = vars["--line"];
  const lineStrong = vars["--line-strong"];
  const accent = vars["--accent"];

  const comment = stripHash(vars["--syntax-comment"]);
  const keyword = stripHash(vars["--syntax-keyword"]);
  const string_ = stripHash(vars["--syntax-string"]);
  const primitive = stripHash(vars["--syntax-primitive"]);
  const variable = stripHash(vars["--syntax-variable"]);
  const property = stripHash(vars["--syntax-property"]);
  const type = stripHash(vars["--syntax-type"]);
  const constant = stripHash(vars["--syntax-constant"]);
  const operator = stripHash(vars["--syntax-operator"]);
  const punctuation = stripHash(vars["--syntax-punctuation"]);
  const object = stripHash(vars["--syntax-object"]);
  const green = stripHash(vars["--green"]);
  const red = stripHash(vars["--red"]);

  return {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "", foreground: punctuation, background: stripHash(bg) },
      { token: "invalid", foreground: red, fontStyle: "italic" },
      { token: "emphasis", fontStyle: "italic" },
      { token: "strong", fontStyle: "bold" },

      { token: "comment", foreground: comment, fontStyle: "italic" },
      { token: "comment.line", foreground: comment, fontStyle: "italic" },
      { token: "comment.block", foreground: comment, fontStyle: "italic" },
      { token: "comment.doc", foreground: comment, fontStyle: "italic" },

      { token: "keyword", foreground: keyword },
      { token: "keyword.control", foreground: keyword },
      { token: "keyword.operator", foreground: operator },
      { token: "keyword.other", foreground: keyword },

      { token: "storage", foreground: keyword },
      { token: "storage.type", foreground: type, fontStyle: "italic" },
      { token: "storage.modifier", foreground: type, fontStyle: "italic" },

      { token: "constant", foreground: constant },
      { token: "constant.numeric", foreground: constant },
      { token: "constant.language", foreground: constant },
      { token: "constant.character", foreground: constant },
      { token: "constant.other", foreground: constant },

      { token: "variable", foreground: variable },
      { token: "variable.language", foreground: keyword },
      { token: "variable.parameter", foreground: variable, fontStyle: "italic" },
      { token: "variable.other", foreground: variable },

      { token: "string", foreground: string_ },
      { token: "string.quoted", foreground: string_ },
      { token: "string.unquoted", foreground: string_ },
      { token: "string.regexp", foreground: string_ },
      { token: "string.template", foreground: string_ },

      { token: "type", foreground: type },
      { token: "type.builtin", foreground: type },
      { token: "type.definition", foreground: type },

      { token: "function", foreground: primitive },
      { token: "function.declaration", foreground: primitive },
      { token: "function.builtin", foreground: primitive },

      { token: "entity.name.type", foreground: type },
      { token: "entity.name.type.class", foreground: type },
      { token: "entity.name.function", foreground: primitive },
      { token: "entity.name.tag", foreground: keyword },
      { token: "entity.other.attribute-name", foreground: property },
      { token: "entity.other.inherited-class", foreground: type, fontStyle: "italic" },

      { token: "support.function", foreground: primitive },
      { token: "support.constant", foreground: constant },
      { token: "support.type", foreground: type, fontStyle: "italic" },
      { token: "support.class", foreground: type, fontStyle: "italic" },

      { token: "delimiter", foreground: punctuation },
      { token: "delimiter.curly", foreground: punctuation },
      { token: "delimiter.bracket", foreground: punctuation },
      { token: "delimiter.parenthesis", foreground: punctuation },
      { token: "delimiter.angle", foreground: punctuation },
      { token: "delimiter.comma", foreground: punctuation },
      { token: "delimiter.period", foreground: punctuation },
      { token: "delimiter.semicolon", foreground: punctuation },

      { token: "meta.tag", foreground: punctuation },
      { token: "meta.selector", foreground: keyword },

      { token: "markup.heading", foreground: keyword, fontStyle: "bold" },
      { token: "markup.bold", fontStyle: "bold" },
      { token: "markup.italic", fontStyle: "italic" },
      { token: "markup.strikethrough", foreground: comment },
      { token: "markup.list", foreground: keyword },
      { token: "markup.inline.raw", foreground: string_ },

      { token: "diff.inserted", foreground: green },
      { token: "diff.removed", foreground: red },
      { token: "diff.header", foreground: type },
    ],
    colors: {
      "editor.background": bg,
      "editor.foreground": fg,
      "editorLineNumber.foreground": vars["--knob-bg"],
      "editorLineNumber.activeForeground": fg,
      "editor.lineHighlightBackground": bg2,
      "editor.selectionBackground": hexToArgb(lineStrong, 0.3),
      "editorCursor.foreground": accent,
      "editorIndentGuide.background": line,
      "editorIndentGuide.activeBackground": lineStrong,
      "editorWidget.background": bg2,
      "editorWidget.border": line,
      "scrollbarSlider.background": hexToArgb(lineStrong, 0.33),
      "scrollbarSlider.hoverBackground": hexToArgb(lineStrong, 0.5),
      "scrollbarSlider.activeBackground": hexToArgb(lineStrong, 0.8),
      "editor.selectionHighlightBackground": hexToArgb(accent, 0.1),
    },
  };
}
