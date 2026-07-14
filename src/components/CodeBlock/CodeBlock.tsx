import { loader } from "@monaco-editor/react";
import React, { useEffect, useRef, useState } from "react";
import { Tooltip } from "../Tooltip/Tooltip.js";
import "../../styles/CodeBlock.css";
import { useTheme } from "../../hooks/useTheme.js";
import { useI18n } from "../../hooks/useI18n.js";
import { makeMonacoTheme } from "../Themes/monacoThemes.js";

type Monaco = any;

export const SHORT_LANG_TO_MONACO: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  hpp: "cpp",
  cs: "csharp",
  php: "php",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  ps1: "powershell",
  yaml: "yaml",
  yml: "yaml",
  toml: "ini",
  ini: "ini",
  xml: "xml",
  sql: "sql",
  json: "json",
  jsonc: "json",
  md: "markdown",
  markdown: "markdown",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  kt: "kotlin",
  dart: "dart",
  swift: "swift",
  scala: "scala",
  lua: "lua",
  elixir: "ex",
  erl: "erlang",
  clj: "clojure",
  pl: "perl",
  r: "r",
  sol: "solidity",
  vue: "vue",
  svelte: "svelte",
  astro: "astro",
  graphql: "graphql",
  gql: "graphql",
  dockerfile: "dockerfile",
  docker: "dockerfile",
  zig: "zig",
  nim: "nim",
  fs: "fsharp",
  ocaml: "ocaml",
  ml: "ocaml",
  txt: "plaintext",
  plaintext: "plaintext",
  text: "plaintext",
  console: "plaintext",
  log: "plaintext",
  diff: "diff",
};

export function resolveMonacoLang(language: string): string {
  return SHORT_LANG_TO_MONACO[language.toLowerCase()] ?? language;
}

interface DecorationDef {
  lineNumber: number;
  glyphClass: string;
  lineClass?: string;
}

interface CodeBlockProps {
  language: string;
  code: string;
  decorations?: DecorationDef[];
}

loader.config({
  paths: {
    vs: "./monaco-editor/min/vs",
  },
});
const monacoPromise = loader.init().catch((err: any) => {
  console.error("[CodeBlock] loader.init() failed:", err);
  return null;
});

export const CodeBlock = React.memo(function CodeBlock({ language, code, decorations }: CodeBlockProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const displayCode = code.trimEnd();
  const codeRef = useRef(displayCode);
  codeRef.current = displayCode;

  const { currentTheme, previewTheme, colorScheme } = useTheme();
  const activeTheme = previewTheme ?? currentTheme;
  const resolvedScheme =
    colorScheme === "system"
      ? window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark"
      : colorScheme;
  const isDark = resolvedScheme === "dark";
  const themeVars = isDark ? activeTheme.darkVars : activeTheme.lightVars;
  const monacoThemeName = `vibe-codeblock-${activeTheme.id}-${resolvedScheme}`;

  const monacoLang = SHORT_LANG_TO_MONACO[language.toLowerCase()] ?? language;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    monacoPromise.then((m) => {
      if (!m || cancelled || !container) return;

      m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));

      const editor = m.editor.create(container, {
        value: displayCode,
        language: monacoLang,
        theme: monacoThemeName,
        fontSize: 12,
        fontFamily: "var(--mono)",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        readOnly: true,
        renderLineHighlight: "none",
        scrollbar: {
          vertical: "auto",
          horizontal: "hidden",
          handleMouseWheel: false,
        },
        lineNumbers: "off",
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        padding: { top: 6, bottom: 6 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
      });

      monacoRef.current = m;
      editorRef.current = editor;

      const updateHeight = () => {
        if (!container || !editor) return;
        const h = editor.getContentHeight();
        const clampedH = Math.max(Math.min(h, 600), 20);
        container.style.height = `${clampedH}px`;
        editor.layout();
      };

      updateHeight();
      setIsEditorReady(true);

      const disposable = editor.onDidContentSizeChange(updateHeight);

      const onWheel = (e: WheelEvent) => {
        const ed = editorRef.current;
        if (!ed) return;
        const scrollTop = ed.getScrollTop();
        const scrollHeight = ed.getScrollHeight();
        const height = ed.getLayoutInfo().height;
        const atTop = scrollTop <= 0;
        const atBottom = scrollTop + height >= scrollHeight;
        if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) {
          e.preventDefault();
          ed.setScrollPosition({ scrollTop: scrollTop + e.deltaY });
        }
      };
      container.addEventListener("wheel", onWheel, { passive: false });

      cleanupRef.current = () => {
        container.removeEventListener("wheel", onWheel);
        try {
          disposable.dispose();
        } catch {
          /* already disposed */
        }
        try {
          editor.dispose();
        } catch {
          /* already disposed */
        }
        editorRef.current = null;
        monacoRef.current = null;
        setIsEditorReady(false);
      };
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [monacoLang, themeVars, isDark, monacoThemeName, displayCode]);

  useEffect(() => {
    const ed = editorRef.current;
    const m = monacoRef.current;
    if (!ed || !m) return;
    try {
      m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));
      ed.updateOptions({ theme: monacoThemeName });
    } catch {
      // editor may be disposed during rapid streaming
    }
  }, [themeVars, monacoThemeName, isDark, isEditorReady]);

  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) return;
    const model = ed.getModel();
    if (!model || model.isDisposed?.()) return;
    const latestCode = codeRef.current;
    if (model.getValue() !== latestCode) {
      model.setValue(latestCode);
      try {
        const h = Math.max(Math.min(ed.getContentHeight(), 600), 20);
        if (containerRef.current) {
          containerRef.current.style.height = `${h}px`;
        }
        ed.layout();
      } catch {
        // editor might be disposed during rapid streaming
      }
    }
  }, [displayCode]);

  useEffect(() => {
    const m = monacoRef.current;
    const ed = editorRef.current;
    if (!m || !ed || !decorations) return;
    const model = ed.getModel();
    if (!model) return;
    const decos = decorations.map((d: any) => ({
      range: new m.Range(d.lineNumber, 1, d.lineNumber, 1),
      options: {
        isWholeLine: true,
        inlineClassName: d.lineClass || undefined,
        glyphMarginClassName: d.glyphClass,
      },
    }));
    ed.deltaDecorations([], decos);
  }, [decorations, isEditorReady]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block">
      <Tooltip text={t("copyCode")}>
        <button className="code-block__copy" onClick={handleCopy}>
          {copied ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--green)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      </Tooltip>
      <div className="code-block__body">
        {!isEditorReady && (
          <pre className="code-block__pre">
            <code className="code-block__code">{displayCode}</code>
          </pre>
        )}
        <div
          ref={containerRef}
          className="code-block__container"
          style={{ display: isEditorReady ? "block" : "none" }}
        />
      </div>
    </div>
  );
});
