// Application command dispatch: maps command ids and keyboard shortcuts to
// workspace intents. Terminal and search panels listen for the dispatched
// DOM events (existing adapter contract).
import { useCallback } from "react";
import { useShortcuts } from "@/features/shortcuts/application/useShortcuts";
import type { useWorkspaceLayout } from "@/shell/useWorkspaceLayout";

export interface AppCommandActions {
  newChat: () => void;
  clearChat: () => void;
  switchChat: (dir: "prev" | "next") => void;
  newProject: () => void;
  closeProject: () => void;
  pickProjectByIndex: (index: number) => void;
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  openSearch: () => void;
}

type WorkspaceLayout = ReturnType<typeof useWorkspaceLayout>;

function dispatchWindowCommand(eventName: string, detail?: unknown): void {
  window.dispatchEvent(detail === undefined ? new CustomEvent(eventName) : new CustomEvent(eventName, { detail }));
}

export function useAppCommands(layout: WorkspaceLayout, actions: AppCommandActions) {
  const {
    setTerminalOpen,
    setFileTreeOpen,
    setGitPanelOpen,
    handleToggleChatSide,
    handleCloseActiveFile,
    handleCycleFileTab,
    handleToggleSearchInCode,
    searchInCodeOpen,
  } = layout;

  const handleCommand = useCallback(
    (id: string) => {
      switch (id) {
        case "new-session":
          actions.newChat();
          break;
        case "prev-session":
          actions.switchChat("prev");
          break;
        case "next-session":
          actions.switchChat("next");
          break;
        case "toggle-terminal":
          setTerminalOpen((o) => !o);
          break;
        case "close-terminal":
          dispatchWindowCommand("vibe:close-terminal");
          break;
        case "new-terminal":
          dispatchWindowCommand("vibe:new-terminal");
          break;
        case "show-file-tree":
          setFileTreeOpen(true);
          break;
        case "hide-file-tree":
          setFileTreeOpen(false);
          break;
        case "toggle-file-tree":
          setFileTreeOpen((o) => !o);
          break;
        case "toggle-chat-side":
          handleToggleChatSide();
          break;
        case "open-settings":
          actions.openSettings();
          break;
        case "close-project":
          actions.closeProject();
          break;
        case "new-project":
          actions.newProject();
          break;
        case "close-file":
          handleCloseActiveFile();
          break;
        case "clear-chat":
          actions.clearChat();
          break;
        case "toggle-git-panel":
          setGitPanelOpen((o) => !o);
          break;
      }
    },
    [actions, setTerminalOpen, setFileTreeOpen, setGitPanelOpen, handleToggleChatSide, handleCloseActiveFile],
  );

  const dispatchIfSearchOpen = useCallback(
    (eventName: string) => {
      if (!searchInCodeOpen) return;
      dispatchWindowCommand(eventName);
    },
    [searchInCodeOpen],
  );

  const { shortcuts, updateBinding, resetBinding } = useShortcuts({
    newChat: actions.newChat,
    switchChat: actions.switchChat,
    toggleChatSide: handleToggleChatSide,
    toggleTerminal: () => setTerminalOpen((o) => !o),
    toggleFileTree: () => setFileTreeOpen((o) => !o),
    openSettings: actions.openSettings,
    openSearch: actions.openSearch,
    openSearchInCode: handleToggleSearchInCode,
    searchToggleMatchCase: () => dispatchIfSearchOpen("vibe:search-toggle-match-case"),
    searchToggleWholeWord: () => dispatchIfSearchOpen("vibe:search-toggle-whole-word"),
    searchToggleRegex: () => dispatchIfSearchOpen("vibe:search-toggle-regex"),
    searchToggleReplace: () => dispatchIfSearchOpen("vibe:search-toggle-replace"),
    searchToggleFilters: () => dispatchIfSearchOpen("vibe:search-toggle-filters"),
    searchToggleTree: () => dispatchIfSearchOpen("vibe:search-toggle-tree"),
    searchRefresh: () => dispatchIfSearchOpen("vibe:search-refresh"),
    searchClear: () => dispatchIfSearchOpen("vibe:search-clear"),
    closeSettings: actions.closeSettings,
    clearChat: actions.clearChat,
    focusInput: () => {
      const el = document.querySelector<HTMLElement>('[data-component="prompt-input"]');
      el?.focus();
    },
    closeActiveFile: handleCloseActiveFile,
    cycleFileTab: handleCycleFileTab,
    newProject: actions.newProject,
    closeProject: actions.closeProject,
    newTerminal: () => dispatchWindowCommand("vibe:new-terminal"),
    switchTerminal: (dir) => dispatchWindowCommand("vibe:switch-terminal", { dir }),
    closeTerminal: () => dispatchWindowCommand("vibe:close-terminal"),
    pickProject: actions.pickProjectByIndex,
  });

  return { handleCommand, shortcuts, updateBinding, resetBinding };
}
