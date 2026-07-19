import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ContentMatch, FileGroupEntry } from "../../../types.js";
import { computeFlatRows, computeTreeNodes, type TreeNode, type FlatRow } from "../utils/searchTreeUtils.js";
import { useSearchShortcuts } from "./useSearchShortcuts.js";
import { useSearchKeyboardNav } from "./useSearchKeyboardNav.js";

export { type FlatRow } from "../utils/searchTreeUtils.js";

export interface UseCodeSearchProps {
  cwd: string;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
  onClose: () => void;
}

export function useCodeSearch({ cwd, onOpenFile, onClose }: UseCodeSearchProps) {
  const [query, setQuery] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [preserveCase, setPreserveCase] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [includeFilter, setIncludeFilter] = useState("");
  const [excludeFilter, setExcludeFilter] = useState("");
  const [searching, setSearching] = useState(false);
  const [viewAsTree, setViewAsTree] = useState(false);
  const [collapsedTree, setCollapsedTree] = useState<Set<string>>(new Set());

  const [fileEntries, setFileEntries] = useState<FileGroupEntry[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [fileMatchesMap, setFileMatchesMap] = useState<Record<string, { matches: ContentMatch[]; total: number }>>({});
  const [loadingFiles, setLoadingFiles] = useState<Set<string>>(new Set());
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParamsRef = useRef({ query, useRegex, includeFilter, excludeFilter, matchCase, matchWholeWord, cwd });
  searchParamsRef.current = { query, useRegex, includeFilter, excludeFilter, matchCase, matchWholeWord, cwd };
  const searchGenRef = useRef(0);
  const committedQueryRef = useRef({ query: "", matchCase: false, lang: "" });

  const fileMatchesRef = useRef(fileMatchesMap);
  fileMatchesRef.current = fileMatchesMap;
  const loadingFilesRef = useRef(loadingFiles);
  loadingFilesRef.current = loadingFiles;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [viewAsTree, query, fileEntries]);

  const loadFileMatches = useCallback(async (path: string) => {
    if (fileMatchesRef.current[path] || loadingFilesRef.current.has(path)) return;
    const p = searchParamsRef.current;
    const gen = searchGenRef.current;
    setLoadingFiles((prev) => new Set(prev).add(path));
    try {
      const res = await (window as any).vibe.fs.searchContentFileMatches(
        p.cwd,
        p.query,
        p.matchCase,
        p.matchWholeWord,
        p.useRegex,
        p.includeFilter,
        p.excludeFilter,
        path,
        0,
        200,
      );
      if (res.ok && gen === searchGenRef.current) {
        setFileMatchesMap((prev) => ({ ...prev, [path]: { matches: res.matches ?? [], total: res.total } }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  }, []);

  const scheduleSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const queryStr = q;
      const gen = ++searchGenRef.current;
      debounceRef.current = setTimeout(async () => {
        if (!queryStr.trim() || !cwd) {
          setFileEntries([]);
          setTotalMatches(0);
          setFileMatchesMap({});
          committedQueryRef.current = { query: "", matchCase: false, lang: "" };
          return;
        }
        const p = searchParamsRef.current;
        setSearching(true);
        setFileMatchesMap({});
        try {
          const res = await (window as any).vibe.fs.searchContentFiles(
            p.cwd,
            queryStr.trim(),
            p.matchCase,
            p.matchWholeWord,
            p.useRegex,
            p.includeFilter || undefined,
            p.excludeFilter || undefined,
            1000,
          );
          if (res.ok && gen === searchGenRef.current) {
            setFileEntries(res.files ?? []);
            setTotalMatches(res.totalMatches ?? 0);
            committedQueryRef.current = { query: queryStr.trim(), matchCase: p.matchCase, lang: "" };
            if (res.files && res.files.length > 0) {
              setCollapsedFiles(new Set(res.files.map((f: FileGroupEntry) => f.path)));
              setCollapsedTree((prev) => {
                const next = new Set(prev);
                for (const file of res.files as FileGroupEntry[]) next.add(file.rel);
                return next;
              });
            }
          } else {
            setFileEntries([]);
            setTotalMatches(0);
          }
        } catch {
          setFileEntries([]);
          setTotalMatches(0);
        } finally {
          setSearching(false);
        }
      }, 300);
    },
    [cwd],
  );

  const handleQueryChange = useCallback(
    (val: string) => {
      setQuery(val);
      scheduleSearch(val);
    },
    [scheduleSearch],
  );

  const requery = useCallback(() => {
    if (searchParamsRef.current.query.trim()) {
      scheduleSearch(searchParamsRef.current.query);
    }
  }, [scheduleSearch]);

  const handleRefresh = useCallback(() => {
    requery();
  }, [requery]);

  const handleClear = useCallback(() => {
    setQuery("");
    setFileEntries([]);
    setTotalMatches(0);
    setFileMatchesMap({});
    committedQueryRef.current = { query: "", matchCase: false, lang: "" };
    inputRef.current?.focus();
  }, []);

  const toggleFile = useCallback(
    (path: string) => {
      setCollapsedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
          loadFileMatches(path);
        } else {
          next.add(path);
        }
        return next;
      });
    },
    [loadFileMatches],
  );

  useEffect(() => {
    if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = setTimeout(() => {
      requery();
    }, 500);
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, [includeFilter, excludeFilter, requery]);

  const flatRows: FlatRow[] = useMemo(
    () => computeFlatRows(fileEntries, collapsedFiles, fileMatchesMap),
    [fileEntries, collapsedFiles, fileMatchesMap],
  );

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => resultsRef.current,
    estimateSize: (index) => {
      const row = flatRows[index];
      return row?.type === "file-header" ? 28 : 22;
    },
    overscan: 20,
  });

  const treeNodes = useMemo(() => {
    if (viewAsTree) return computeTreeNodes(fileEntries, fileMatchesMap);
    return [];
  }, [viewAsTree, fileEntries, fileMatchesMap]);

  const handleCollapseAll = useCallback(() => {
    if (viewAsTree) {
      const all: string[] = [];
      const collect = (nodes: TreeNode[]) => {
        for (const n of nodes) {
          if (n.isDir || n.matchesCount > 0) all.push(n.path);
          collect(n.children);
        }
      };
      collect(treeNodes);
      setCollapsedTree(new Set(all));
    } else {
      const all = fileEntries.map((g) => g.path);
      setCollapsedFiles(new Set(all));
    }
  }, [fileEntries, treeNodes, viewAsTree]);

  const toggleTreeNode = useCallback(
    (path: string, filePath?: string) => {
      const opening = collapsedTree.has(path);
      setCollapsedTree((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      if (opening && filePath) void loadFileMatches(filePath);
    },
    [collapsedTree, loadFileMatches],
  );

  // Hook subscriptions
  useSearchShortcuts({
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
  });

  const { handleKeyDown, handleInputKeyDown } = useSearchKeyboardNav({
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
  });

  return {
    query,
    setQuery,
    replaceText,
    setReplaceText,
    matchCase,
    setMatchCase,
    matchWholeWord,
    setMatchWholeWord,
    useRegex,
    setUseRegex,
    preserveCase,
    setPreserveCase,
    replaceOpen,
    setReplaceOpen,
    showFilters,
    setShowFilters,
    includeFilter,
    setIncludeFilter,
    excludeFilter,
    setExcludeFilter,
    searching,
    viewAsTree,
    setViewAsTree,
    collapsedTree,
    fileEntries,
    totalMatches,
    fileMatchesMap,
    loadingFiles,
    collapsedFiles,
    selectedIndex,
    setSelectedIndex,
    inputRef,
    resultsRef,
    containerRef,
    committedQueryRef,
    flatRows,
    virtualizer,
    treeNodes,
    handleQueryChange,
    handleRefresh,
    handleClear,
    handleInputKeyDown,
    handleKeyDown,
    toggleFile,
    toggleTreeNode,
    handleCollapseAll,
  };
}
