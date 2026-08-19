import type React from "react";
import { useCallback, useState } from "react";
import type { Attachment } from "../../../common/chat";
import { setCursorPosition } from "../utils/editorDom";
import { type HistoryEntry, navigatePromptHistory, prependHistoryEntry } from "../utils/history";

interface PromptHistoryOptions {
  editorRef: React.RefObject<HTMLDivElement | null>;
  editorText: () => string;
  setEditorText: (text: string) => void;
  clearEditor: () => void;
}

/**
 * Prompt history navigation (ArrowUp/ArrowDown): stores submitted prompts and
 * restores their text into the editor while browsing.
 */
export function usePromptHistory({ editorRef, editorText, setEditorText, clearEditor }: PromptHistoryOptions) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [savedText, setSavedText] = useState<string | null>(null);

  /** Drop navigation state, e.g. after fresh user input or submit. */
  const reset = useCallback(() => {
    setHistoryIndex(-1);
    setSavedText(null);
  }, []);

  /** Store a submitted prompt as the newest history entry. */
  const commit = useCallback((text: string, attachments: Attachment[]) => {
    setEntries((prev) => prependHistoryEntry(prev, text, attachments));
  }, []);

  const navigate = useCallback(
    (direction: "up" | "down"): boolean => {
      const result = navigatePromptHistory({
        direction,
        entries,
        historyIndex,
        currentText: editorText(),
        savedText,
      });
      if (!result.handled) return false;
      setHistoryIndex(result.historyIndex);
      setSavedText(result.savedText);
      const el = editorRef.current;
      if (!el) return true;
      if (result.entry.text) setEditorText(result.entry.text);
      else clearEditor();
      requestAnimationFrame(() => setCursorPosition(el, result.cursor === "end" ? result.entry.text.length : 0));
      return true;
    },
    [entries, historyIndex, savedText, editorRef, editorText, setEditorText, clearEditor],
  );

  return { historyIndex, navigate, reset, commit };
}
