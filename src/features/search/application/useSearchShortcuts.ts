import { useEffect } from "react";

export interface UseSearchShortcutsProps {
  query: string;
  scheduleSearch: (q: string) => void;
  requery: () => void;
  setMatchCase: React.Dispatch<React.SetStateAction<boolean>>;
  setMatchWholeWord: React.Dispatch<React.SetStateAction<boolean>>;
  setUseRegex: React.Dispatch<React.SetStateAction<boolean>>;
  setReplaceOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFilters: React.Dispatch<React.SetStateAction<boolean>>;
  setViewAsTree: React.Dispatch<React.SetStateAction<boolean>>;
  handleRefresh: () => void;
  handleClear: () => void;
}

export function useSearchShortcuts({
  query,
  scheduleSearch,
  requery,
  setMatchCase,
  setMatchWholeWord,
  setUseRegex,
  setReplaceOpen,
  setShowFilters,
  setViewAsTree,
  handleRefresh,
  handleClear,
}: UseSearchShortcutsProps): void {
  useEffect(() => {
    function handler() {
      setMatchCase((v) => !v);
      requery();
    }
    window.addEventListener("vibe:search-toggle-match-case", handler);
    return () => window.removeEventListener("vibe:search-toggle-match-case", handler);
  }, [requery, setMatchCase]);

  useEffect(() => {
    function handler() {
      setMatchWholeWord((v) => !v);
      requery();
    }
    window.addEventListener("vibe:search-toggle-whole-word", handler);
    return () => window.removeEventListener("vibe:search-toggle-whole-word", handler);
  }, [requery, setMatchWholeWord]);

  useEffect(() => {
    function handler() {
      setUseRegex((v) => !v);
      scheduleSearch(query);
    }
    window.addEventListener("vibe:search-toggle-regex", handler);
    return () => window.removeEventListener("vibe:search-toggle-regex", handler);
  }, [query, scheduleSearch, setUseRegex]);

  useEffect(() => {
    function handler() {
      setReplaceOpen((v) => !v);
    }
    window.addEventListener("vibe:search-toggle-replace", handler);
    return () => window.removeEventListener("vibe:search-toggle-replace", handler);
  }, [setReplaceOpen]);

  useEffect(() => {
    function handler() {
      setShowFilters((v) => !v);
    }
    window.addEventListener("vibe:search-toggle-filters", handler);
    return () => window.removeEventListener("vibe:search-toggle-filters", handler);
  }, [setShowFilters]);

  useEffect(() => {
    function handler() {
      setViewAsTree((v) => !v);
    }
    window.addEventListener("vibe:search-toggle-tree", handler);
    return () => window.removeEventListener("vibe:search-toggle-tree", handler);
  }, [setViewAsTree]);

  useEffect(() => {
    function handler() {
      handleRefresh();
    }
    window.addEventListener("vibe:search-refresh", handler);
    return () => window.removeEventListener("vibe:search-refresh", handler);
  }, [handleRefresh]);

  useEffect(() => {
    function handler() {
      handleClear();
    }
    window.addEventListener("vibe:search-clear", handler);
    return () => window.removeEventListener("vibe:search-clear", handler);
  }, [handleClear]);
}
