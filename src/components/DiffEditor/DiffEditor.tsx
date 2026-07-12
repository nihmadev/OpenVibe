import { loader } from "@monaco-editor/react";
import React, { useEffect, useRef } from "react";
import { useTheme } from "../../hooks/useTheme.js";
import { makeMonacoTheme } from "../Themes/monacoThemes.js";

loader.config({ paths: { vs: "./monaco-editor/min/vs" } });
const monacoPromise = loader.init().catch((err: any) => {
  console.error("[DiffEditor] loader.init() failed:", err);
  return null;
});

interface DiffEditorProps {
  original: string;
  modified: string;
  language: string;
}

export const DiffEditor = React.memo(function DiffEditor({ original, modified, language }: DiffEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const originalRef = useRef(original);
  const modifiedRef = useRef(modified);
  originalRef.current = original;
  modifiedRef.current = modified;

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
  const monacoThemeName = `vibe-diff-${activeTheme.id}-${resolvedScheme}`;

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    monacoPromise.then((m) => {
      if (!m || cancelled || !container) return;

      m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));
      m.editor.setTheme(monacoThemeName);

      const originalModel = m.editor.createModel(originalRef.current, language);
      const modifiedModel = m.editor.createModel(modifiedRef.current, language);

      const diffEditor = m.editor.createDiffEditor(container, {
        renderSideBySide: false,
        readOnly: true,
        fontSize: 12,
        fontFamily: "var(--mono)",
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        lineNumbers: "on",
        folding: false,
        glyphMargin: false,
        lineNumbersMinChars: 3,
        padding: { top: 10, bottom: 10 },
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        renderLineHighlight: "none",
        scrollbar: { vertical: "auto", horizontal: "hidden", handleMouseWheel: false },
        renderMarginRevertIcon: false,
        enableSplitViewResizing: false,
        renderIndicators: false,
      });

      diffEditor.setModel({ original: originalModel, modified: modifiedModel });

      const modifiedEditor = diffEditor.getModifiedEditor();
      const updateHeight = () => {
        if (!container || !modifiedEditor) return;
        const h = modifiedEditor.getContentHeight();
        const clampedH = Math.max(Math.min(h, 600), 20);
        container.style.height = `${clampedH}px`;
        diffEditor.layout();
      };
      updateHeight();
      const disposable = modifiedEditor.onDidContentSizeChange(updateHeight);

      const onWheel = (e: WheelEvent) => {
        const ed = editorRef.current?.getModifiedEditor();
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

      monacoRef.current = m;
      editorRef.current = diffEditor;

      cleanupRef.current = () => {
        container.removeEventListener("wheel", onWheel);
        try {
          disposable.dispose();
        } catch {
          /* ok */
        }
        try {
          originalModel.dispose();
        } catch {
          /* ok */
        }
        try {
          modifiedModel.dispose();
        } catch {
          /* ok */
        }
        try {
          diffEditor.dispose();
        } catch {
          /* ok */
        }
        editorRef.current = null;
        monacoRef.current = null;
      };
    });

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const m = monacoRef.current;
    if (!m) return;
    try {
      m.editor.defineTheme(monacoThemeName, makeMonacoTheme(themeVars, isDark));
      m.editor.setTheme(monacoThemeName);
    } catch {
      /* editor disposed */
    }
  }, [themeVars, monacoThemeName, isDark]);

  useEffect(() => {
    const ed = editorRef.current;
    const m = monacoRef.current;
    if (!ed || !m) return;
    const model = ed.getModel();
    if (!model) return;
    const { original: oModel, modified: modModel } = model;
    if (oModel && !oModel.isDisposed?.() && oModel.getValue() !== originalRef.current) {
      oModel.setValue(originalRef.current);
    }
    if (modModel && !modModel.isDisposed?.() && modModel.getValue() !== modifiedRef.current) {
      modModel.setValue(modifiedRef.current);
    }
  }, [original, modified]);

  return (
    <div className="diff-editor">
      <div ref={containerRef} className="diff-editor__container" />
    </div>
  );
});
