// Workspace layout state: open editor tabs, panel visibility, goto targets.
import { useCallback, useEffect, useState } from "react";

export function useWorkspaceLayout() {
  const [chatSideOpen, setChatSideOpen] = useState(true);
  const [chatSideSticky, setChatSideSticky] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(275);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [searchInCodeOpen, setSearchInCodeOpen] = useState(false);
  const [fileTreeOpen, setFileTreeOpen] = useState(false);
  const [gitPanelOpen, setGitPanelOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [gotoLine, setGotoLine] = useState<number | undefined>(undefined);
  const [gotoColumn, setGotoColumn] = useState<number | undefined>(undefined);
  const [gotoMatchLength, setGotoMatchLength] = useState<number | undefined>(undefined);

  useEffect(() => {
    const handler = () => setTerminalOpen(false);
    window.addEventListener("vibe:close-terminal-panel", handler);
    return () => window.removeEventListener("vibe:close-terminal-panel", handler);
  }, []);

  const handleOpenFile = useCallback(
    (path: string, line?: number, column?: number, matchLength?: number) => {
      let needsPreview = false;
      setOpenFiles((prev) => {
        if (prev.includes(path)) return prev;
        needsPreview = true;
        const previewIdx = previewFile !== null ? prev.indexOf(previewFile) : -1;
        if (previewIdx !== -1) {
          const next = [...prev];
          next[previewIdx] = path;
          return next;
        }
        return [...prev, path];
      });
      setActiveFile(path);
      if (needsPreview) setPreviewFile(path);
      setGotoLine(line);
      setGotoColumn(column);
      setGotoMatchLength(matchLength);
    },
    [previewFile],
  );

  const handlePinFile = useCallback((path: string) => {
    setPreviewFile((prev) => (prev === path ? null : prev));
  }, []);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((p) => p !== path);
      setActiveFile((cur) => {
        if (cur !== path) return cur;
        if (next.length === 0) return null;
        const idx = prev.indexOf(path);
        return next[Math.min(idx, next.length - 1)] ?? null;
      });
      setPreviewFile((cur) => (cur === path ? null : cur));
      return next;
    });
  }, []);

  const handleActivateFile = useCallback((path: string) => {
    setActiveFile(path);
  }, []);

  const handleCloseActiveFile = useCallback(() => {
    if (activeFile) handleCloseFile(activeFile);
  }, [activeFile, handleCloseFile]);

  const handleCycleFileTab = useCallback(
    (dir: "prev" | "next") => {
      if (openFiles.length === 0) return;
      const idx = openFiles.indexOf(activeFile ?? "");
      if (idx < 0) {
        handleActivateFile(openFiles[0]!);
        return;
      }
      const nextIdx = dir === "next" ? (idx + 1) % openFiles.length : (idx - 1 + openFiles.length) % openFiles.length;
      handleActivateFile(openFiles[nextIdx]!);
    },
    [openFiles, activeFile, handleActivateFile],
  );

  const handleToggleChatSide = useCallback(() => {
    setChatSideSticky((s) => !s);
    setChatSideOpen((o) => !o);
  }, []);

  const handleToggleSearchInCode = useCallback(() => {
    setSearchInCodeOpen((o) => !o);
  }, []);

  const handleToggleGitPanel = useCallback(() => {
    setGitPanelOpen((o) => !o);
  }, []);

  return {
    chatSideOpen,
    setChatSideOpen,
    chatSideSticky,
    setChatSideSticky,
    sidebarWidth,
    setSidebarWidth,
    terminalOpen,
    setTerminalOpen,
    searchInCodeOpen,
    setSearchInCodeOpen,
    fileTreeOpen,
    setFileTreeOpen,
    gitPanelOpen,
    setGitPanelOpen,
    browserOpen,
    setBrowserOpen,
    openFiles,
    activeFile,
    previewFile,
    gotoLine,
    gotoColumn,
    gotoMatchLength,
    handleOpenFile,
    handlePinFile,
    handleCloseFile,
    handleActivateFile,
    handleCloseActiveFile,
    handleCycleFileTab,
    handleToggleChatSide,
    handleToggleSearchInCode,
    handleToggleGitPanel,
  };
}
