import { Editor as MonacoEditor } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import type React from "react";
import { useEffect, useMemo, useRef } from "react";
import ReactDOM from "react-dom";
import { getLanguage } from "@/base/browser/ui/icons/iconResolver";
import { useI18n } from "@/platform/localization/localizationService";
import { useTheme } from "@/platform/theme/themeService";
import type { MonacoLspSession } from "../../../../services/languageServer/browser/monacoLanguageServerClient";
import { makeMonacoTheme } from "../monacoThemes";
import "./monacoSetup";
import "./editor.css";
import type { EditorProps } from "./editorState";
import { InlineVibeConnector } from "./inlineVibeConnector";
import { InlineActionPill, InlinePromptPanel } from "./inlineVibePanel";
import { useEditorDocument, useEditorNavigation } from "./useEditorDocument";
import { useEditorLsp } from "./useEditorLanguageServer";
import { useEditorMount } from "./useEditorMount";
import { useEditorSettings } from "./useEditorSettings";
import { useInlineVibe } from "./useInlineVibe";

export function Editor({
  path,
  cwd,
  onDirtyChange,
  gotoLine,
  gotoColumn,
  gotoMatchLength,
}: EditorProps): React.ReactElement {
  const { t } = useI18n();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const lspSessionRef = useRef<MonacoLspSession | null>(null);
  const refs = useMemo(() => ({ editor: editorRef, monaco: monacoRef }), []);
  const cleanupInlineRef = useRef<() => void>(() => {});

  const document = useEditorDocument({
    path,
    cwd,
    onDirtyChange,
    refs,
    lspSessionRef,
    cleanupInlineSession: useMemo(() => () => cleanupInlineRef.current(), []),
  });
  const inline = useInlineVibe(path, refs, document.setContent);
  cleanupInlineRef.current = inline.cleanup;
  useEditorLsp(refs, lspSessionRef, document.content === null, cwd);
  useEditorNavigation(refs, gotoLine, gotoColumn, gotoMatchLength);
  const editorSettings = useEditorSettings();

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
  const themeName = `vibe-editor-${activeTheme.id}-${resolvedScheme}`;

  useEffect(() => {
    const m = refs.monaco.current;
    if (!m) return;
    m.editor.defineTheme(themeName, makeMonacoTheme(themeVars, isDark));
    m.editor.setTheme(themeName);
  }, [isDark, refs, themeName, themeVars]);

  const mount = useEditorMount({
    path,
    cwd,
    content: document.content ?? "",
    original: document.original,
    gotoLine,
    gotoColumn,
    gotoMatchLength,
    themeName,
    themeVars,
    isDark,
    refs,
    setContent: document.setContent,
    loadingRef: inline.loadingRef,
    sessionRef: inline.sessionRef,
    updateGhostTextRef: inline.updateGhostTextRef,
    actions: {
      trigger: inline.trigger,
      accept: inline.accept,
      reject: inline.reject,
      navigate: inline.navigate,
    },
  });

  if (document.error) {
    return (
      <div className="editor editor--error">
        <span className="editor__error-title">{t("cannotOpenFile")}</span>
        <span className="editor__error-msg">{document.error}</span>
        <button className="editor__retry" onClick={document.retry}>
          {t("retry")}
        </button>
      </div>
    );
  }
  if (document.content === null) return <div className="editor editor--loading">{t("loading")}</div>;

  return (
    <div className="editor">
      <MonacoEditor
        height="100%"
        // Models are shared through MODEL_CACHE and must outlive this React view.
        keepCurrentModel
        theme={themeName}
        path={`file://${path.replace(/\\/g, "/")}`}
        language={getLanguage(path)}
        value={inline.loading ? undefined : document.content}
        loading={<div className="editor" />}
        beforeMount={mount.beforeMount}
        onMount={mount.onMount}
        options={{
          fontFamily: '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace',
          ...editorSettings,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderLineHighlight: "line",
          smoothScrolling: true,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          lineNumbersMinChars: 4,
          lineDecorationsWidth: 12,
          glyphMargin: false,
          folding: false,
          fixedOverflowWidgets: true,
          padding: { top: 10, bottom: 10 },
          scrollbar: {
            vertical: "hidden",
            horizontal: "hidden",
            useShadows: false,
            verticalScrollbarSize: 0,
            horizontalScrollbarSize: 0,
          },
        }}
      />
      {inline.zoneNode &&
        ReactDOM.createPortal(
          <div className="inline-vibe-portal-root">
            {inline.hasDiff && (
              <InlineActionPill
                onAccept={inline.accept}
                onReject={inline.reject}
                onNextDiff={() => inline.navigate("next")}
                onPrevDiff={() => inline.navigate("prev")}
              />
            )}
            <InlinePromptPanel
              onSend={inline.sendPrompt}
              onClose={inline.cleanup}
              loading={inline.loading}
              placeholder={inline.hasDiff ? t("inlineRefineCode") : t("inlineEditCode")}
            />
          </div>,
          inline.zoneNode,
        )}
      {inline.zoneNode && inline.sessionRef.current && (
        <InlineVibeConnector
          editor={refs.editor.current}
          monacoInstance={refs.monaco.current}
          session={inline.sessionRef.current}
          zoneNode={inline.zoneNode}
          loading={inline.loading}
        />
      )}
    </div>
  );
}
