import { useCallback, useEffect, useRef } from "react";
import type { EditorRefs, InlineSession } from "./editorTypes";

export function useInlineGhostText(
  refs: EditorRefs,
  zoneNode: HTMLDivElement | null,
  sessionRef: React.MutableRefObject<InlineSession | null>,
) {
  const decorationsRef = useRef<string[]>([]);
  const lastStateRef = useRef<{ lineNumber: number; column: number; text: string } | null>(null);

  const clear = useCallback(() => {
    const editor = refs.editor.current;
    if (editor && decorationsRef.current.length > 0) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
    }
    lastStateRef.current = null;
  }, [refs]);

  const update = useCallback(() => {
    const editor = refs.editor.current;
    const m = refs.monaco.current;
    if (!editor || !m || zoneNode !== null || sessionRef.current !== null) {
      clear();
      return;
    }

    const position = editor.getPosition();
    const model = editor.getModel();
    if (!position || !model) {
      clear();
      return;
    }

    const lineContent = model.getLineContent(position.lineNumber);
    if (lineContent.trim() !== "") {
      clear();
      return;
    }
    if (
      decorationsRef.current.length > 0 &&
      lastStateRef.current?.lineNumber === position.lineNumber &&
      lastStateRef.current?.column === position.column &&
      lastStateRef.current?.text === lineContent
    ) {
      return;
    }

    const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new m.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        options: {
          after: {
            content: `  ${isMac ? "⌘K" : "Ctrl+K"} to generate or edit with Inline Vibe`,
            inlineClassName: "inline-vibe-ghost-text",
          },
        },
      },
    ]);
    lastStateRef.current = { lineNumber: position.lineNumber, column: position.column, text: lineContent };
  }, [clear, refs, sessionRef, zoneNode]);

  const updateRef = useRef(update);
  useEffect(() => {
    updateRef.current = update;
    update();
  }, [update]);

  return { clearGhostText: clear, updateGhostTextRef: updateRef };
}
