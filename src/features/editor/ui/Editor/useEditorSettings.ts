import type * as monaco from "monaco-editor";
import { useEffect, useState } from "react";
import { appState } from "@/shared/api/keyValueStore";

export interface EditorSettings {
  fontSize: number;
  lineHeight: number;
  fontLigatures: boolean;
  cursorStyle: monaco.editor.IEditorOptions["cursorStyle"];
  cursorBlinking: monaco.editor.IEditorOptions["cursorBlinking"];
}

const DEFAULT_SETTINGS: EditorSettings = {
  fontSize: 13,
  lineHeight: 19.5,
  fontLigatures: false,
  cursorStyle: "line",
  cursorBlinking: "blink",
};

export function useEditorSettings(): EditorSettings {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    Promise.all([
      appState.get("settings:editorFontSize"),
      appState.get("settings:editorLineHeight"),
      appState.get("settings:editorLigatures"),
      appState.get("settings:editorCursorStyle"),
      appState.get("settings:editorCursorBlink"),
    ]).then(([size, lineHeight, ligatures, cursorStyle, cursorBlinking]) => {
      const fontSize = size ? parseInt(size, 10) : 13;
      setSettings({
        fontSize,
        lineHeight: fontSize * (lineHeight ? parseFloat(lineHeight) : 1.5),
        fontLigatures: ligatures === "true",
        cursorStyle: (cursorStyle || "line") as EditorSettings["cursorStyle"],
        cursorBlinking: (cursorBlinking || "blink") as EditorSettings["cursorBlinking"],
      });
    });

    const handleChange = (event: Event) => {
      const { key, value } = (event as CustomEvent<{ key: string; value: string | boolean }>).detail;
      setSettings((previous) => {
        const next = { ...previous };
        if (key === "editorFontSize") {
          next.fontSize = parseInt(String(value), 10);
          next.lineHeight = next.fontSize * (previous.lineHeight / previous.fontSize || 1.5);
        }
        if (key === "editorLineHeight") next.lineHeight = parseFloat(String(value)) * next.fontSize;
        if (key === "editorLigatures") next.fontLigatures = value === true || value === "true";
        if (key === "editorCursorStyle") next.cursorStyle = String(value) as EditorSettings["cursorStyle"];
        if (key === "editorCursorBlink") next.cursorBlinking = String(value) as EditorSettings["cursorBlinking"];
        return next;
      });
    };

    window.addEventListener("settings-changed", handleChange);
    return () => window.removeEventListener("settings-changed", handleChange);
  }, []);

  return settings;
}
