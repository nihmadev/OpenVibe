import { loader } from "@monaco-editor/react";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Tooltip } from "../Tooltip/Tooltip.js";
import "../../styles/CodeBlock.css";
import { useTheme } from "../../hooks/useTheme.js";
import { useI18n } from "../../hooks/useI18n.js";
import { makeMonacoTheme } from "../Themes/monacoThemes.js";
import { CopyIcon, InsertTerminalIcon, RunIcon } from "../icons/icons.js";
import { useTerminalActions } from "../../hooks/useTerminalActions.js";

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
  shell: "shell",
  terminal: "shell",
  command: "shell",
  ps1: "powershell",
  powershell: "powershell",
  cmd: "powershell",
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

const TERMINAL_LANGS = new Set([
  "sh",
  "bash",
  "zsh",
  "shell",
  "powershell",
  "ps1",
  "cmd",
  "command",
  "console",
  "terminal",
]);

export function isTerminalLanguage(lang: string): boolean {
  return TERMINAL_LANGS.has(lang.toLowerCase());
}

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

let cachedMonaco: Monaco | null = null;
const monacoPromise = loader
  .init()
  .then((m) => {
    cachedMonaco = m;
    return m;
  })
  .catch((err: any) => {
    console.error("[CodeBlock] loader.init() failed:", err);
    return null;
  });

export const CodeBlock = React.memo(function CodeBlock({ language, code, decorations }: CodeBlockProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(() => cachedMonaco !== null);
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const displayCode = code.trimEnd();
  const codeRef = useRef(displayCode);
  codeRef.current = displayCode;
  const { runCommand, insertCommand } = useTerminalActions();

  const isTerminal = isTerminalLanguage(language);

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

  useLayoutEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    const setupEditor = (m: Monaco) => {
      if (cancelled || !container) return;

      m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));

      const initialCode = codeRef.current;
      const initialLines = initialCode.split("\n").length;
      const initialHeight = Math.max(Math.min(initialLines * 18 + 12, 600), 26);
      container.style.height = `${initialHeight}px`;

      const editor = m.editor.create(container, {
        value: initialCode,
        language: monacoLang,
        theme: monacoThemeName,
        fontSize: 12,
        lineHeight: 18,
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
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6,
          alwaysConsumeMouseWheel: false,
        },
        overviewRulerBorder: false,
        overviewRulerLanes: 0,
        guides: {
          indentation: false,
          highlightActiveIndentation: false,
          bracketPairs: false,
          bracketPairsHorizontal: false,
        },
        renderIndentGuides: false,
        lineNumbers: "off",
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 0,
        lineNumbersMinChars: 0,
        padding: { top: 6, bottom: 6 },
        hideCursorInOverviewRuler: true,
        matchBrackets: "never",
        occurrencesHighlight: "off",
        selectionHighlight: false,
        hover: { enabled: false },
        links: false,
        contextmenu: false,
        quickSuggestions: false,
      });

      monacoRef.current = m;
      editorRef.current = editor;

      let rafId: number | null = null;
      const updateHeight = () => {
        if (!container || !editor) return;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          rafId = null;
          try {
            const h = editor.getContentHeight();
            const clampedH = Math.max(Math.min(h, 600), 26);
            container.style.height = `${clampedH}px`;
            editor.layout();
          } catch {
            /* editor might be disposed */
          }
        });
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
        if (rafId !== null) cancelAnimationFrame(rafId);
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
    };

    if (cachedMonaco) {
      setupEditor(cachedMonaco);
    } else {
      monacoPromise.then((m) => {
        if (m) setupEditor(m);
      });
    }

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [monacoLang]);

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
        const lines = latestCode.split("\n").length;
        const h = Math.max(Math.min(lines * 18 + 12, 600), 26);
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

  const lineCount = displayCode.split("\n").length;
  const estimatedHeight = Math.max(Math.min(lineCount * 18 + 12, 600), 26);

  return (
    <div className={`code-block${isTerminal ? " code-block--terminal" : ""}`}>
      <div className="code-block__actions">
        <Tooltip text={t("copyCode")}>
          <button className="code-block__action-btn" onClick={handleCopy} aria-label={t("copyCode")}>
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
              <CopyIcon />
            )}
          </button>
        </Tooltip>
        {isTerminal && (
          <>
            <Tooltip text={t("insertTerminal")}>
              <button
                className="code-block__action-btn"
                onClick={() => insertCommand(code)}
                aria-label={t("insertTerminal")}
              >
                <InsertTerminalIcon />
              </button>
            </Tooltip>
            <Tooltip text={t("runCommand")}>
              <button
                className="code-block__action-btn"
                onClick={() => runCommand(code)}
                aria-label={t("runCommand")}
              >
                <RunIcon />
              </button>
            </Tooltip>
          </>
        )}
      </div>
      <div className="code-block__body" style={{ minHeight: `${estimatedHeight}px` }}>
        <div
          ref={containerRef}
          className="code-block__container"
          style={{ height: `${estimatedHeight}px` }}
        />
        {!isEditorReady && (
          <pre className="code-block__pre code-block__pre--overlay">
            <code className="code-block__code">{displayCode}</code>
          </pre>
        )}
      </div>
    </div>
  );
});

