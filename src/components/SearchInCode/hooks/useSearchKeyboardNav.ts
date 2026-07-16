import { useCallback, useEffect, useRef } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import type { ContentMatch, FileGroupEntry } from "../../../types.js";
import type { FlatRow } from "../utils/searchTreeUtils.js";

export interface UseSearchKeyboardNavProps {
  query: string;
  flatRows: FlatRow[];
  fileEntries: FileGroupEntry[];
  fileMatchesMap: Record<string, { matches: ContentMatch[]; total: number }>;
  collapsedFiles: Set<string>;
  viewAsTree: boolean;
  selectedIndex: number;
  setSelectedIndex: React.Dispatch<React.SetStateAction<number>>;
  toggleFile: (path: string) => void;
  scheduleSearch: (q: string) => void;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
  onClose: () => void;
  inputRef: React.RefObject<HTMLInputElement>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  committedQueryRef: React.RefObject<{ query: string; matchCase: boolean; lang: string }>;
}

export function useSearchKeyboardNav({
  query,
  flatRows,
  fileEntries,
  fileMatchesMap,
  collapsedFiles,
  viewAsTree,
  selectedIndex,
  setSelectedIndex,
  toggleFile,
  scheduleSearch,
  onOpenFile,
  onClose,
  inputRef,
  virtualizer,
  committedQueryRef,
}: UseSearchKeyboardNavProps) {
  const keyboardNavRef = useRef(false);

  function keyboardSetIndex(i: number): void {
    keyboardNavRef.current = true;
    setSelectedIndex(i);
  }

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        scheduleSearch(query);
        e.preventDefault();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        inputRef.current?.blur();
        return;
      }
    },
    [query, scheduleSearch, inputRef],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      const hasResults = !viewAsTree && flatRows.length > 0;

      if (isInput && (e.ctrlKey || e.metaKey) && e.key.length === 1) return;
      if (isInput && e.key.length === 1) return;

      if (!hasResults) {
        if (e.key === "Escape") {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        keyboardSetIndex(selectedIndex < flatRows.length - 1 ? selectedIndex + 1 : 0);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        keyboardSetIndex(selectedIndex > 0 ? selectedIndex - 1 : flatRows.length - 1);
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        keyboardSetIndex(0);
        return;
      }
      if (e.key === "End") {
        e.preventDefault();
        keyboardSetIndex(flatRows.length - 1);
        return;
      }
      if (e.key === "PageDown") {
        e.preventDefault();
        keyboardSetIndex(Math.min(selectedIndex + 20, flatRows.length - 1));
        return;
      }
      if (e.key === "PageUp") {
        e.preventDefault();
        keyboardSetIndex(Math.max(selectedIndex - 20, 0));
        return;
      }

      if (e.key === "Enter" && selectedIndex >= 0) {
        e.preventDefault();
        const row = flatRows[selectedIndex];
        if (!row) return;
        if (row.type === "file-header") {
          const entry = fileEntries[row.fileIndex];
          if (!entry) return;
          const fm = fileMatchesMap[entry.path];
          if (fm && fm.matches.length > 0) {
            const m = fm.matches[0]!;
            const matchLen = committedQueryRef.current?.query.length ?? query.length;
            onOpenFile(m.path, m.line, m.column, matchLen);
            onClose();
          } else if (!collapsedFiles.has(entry.path)) {
            toggleFile(entry.path);
          } else {
            toggleFile(entry.path);
          }
        } else if (row.matchIndex >= 0) {
          const entry = fileEntries[row.fileIndex];
          if (!entry) return;
          const fm = fileMatchesMap[entry.path];
          if (fm && fm.matches[row.matchIndex]) {
            const m = fm.matches[row.matchIndex]!;
            const matchLen = committedQueryRef.current?.query.length ?? query.length;
            onOpenFile(m.path, m.line, m.column, matchLen);
            onClose();
          }
        }
        return;
      }

      if (e.key === "ArrowRight" && selectedIndex >= 0) {
        const row = flatRows[selectedIndex];
        if (row?.type === "file-header") {
          const path = fileEntries[row.fileIndex]!.path;
          if (collapsedFiles.has(path)) toggleFile(path);
        }
        return;
      }
      if (e.key === "ArrowLeft" && selectedIndex >= 0) {
        const row = flatRows[selectedIndex];
        if (row?.type === "file-header") {
          const path = fileEntries[row.fileIndex]!.path;
          if (!collapsedFiles.has(path)) toggleFile(path);
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
    },
    [
      flatRows,
      selectedIndex,
      viewAsTree,
      fileEntries,
      collapsedFiles,
      fileMatchesMap,
      toggleFile,
      onOpenFile,
      onClose,
      committedQueryRef,
      query,
    ],
  );

  useEffect(() => {
    if (selectedIndex >= 0 && !viewAsTree && keyboardNavRef.current) {
      keyboardNavRef.current = false;
      virtualizer.scrollToIndex(selectedIndex, { align: "center" });
    }
  }, [selectedIndex, viewAsTree, virtualizer]);

  return {
    handleKeyDown,
    handleInputKeyDown,
  };
}
