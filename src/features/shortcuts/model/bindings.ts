// Default keyboard shortcut bindings registry.
import { isInputFocused, type KeyCombo, type ShortcutCategory } from "./keyCombo";

/** Handler functions mapped to shortcut trigger actions. */
export interface ShortcutActions {
  newChat: () => void;
  switchChat: (dir: "prev" | "next") => void;
  toggleChatSide: () => void;
  toggleTerminal: () => void;
  toggleFileTree: () => void;
  openSettings: (tab?: string) => void;
  openSearch: () => void;
  openSearchInCode: () => void;
  searchToggleMatchCase: () => void;
  searchToggleWholeWord: () => void;
  searchToggleRegex: () => void;
  searchToggleReplace: () => void;
  searchToggleFilters: () => void;
  searchToggleTree: () => void;
  searchRefresh: () => void;
  searchClear: () => void;
  closeSettings: () => void;
  clearChat: () => void;
  focusInput: () => void;
  closeActiveFile: () => void;
  cycleFileTab: (dir: "prev" | "next") => void;
  newProject: () => void;
  closeProject: () => void;
  newTerminal: () => void;
  switchTerminal: (dir: "prev" | "next") => void;
  closeTerminal: () => void;
  pickProject: (index: number) => void;
}

export interface BindingDef {
  id: string;
  label: string;
  defaultKeys: string;
  category: ShortcutCategory;
  defaultCombo: KeyCombo;
  action: (actions: ShortcutActions) => void;
}

export const DEFAULT_BINDINGS: BindingDef[] = [
  // Navigation
  {
    id: "open-settings",
    label: "Open Settings",
    defaultKeys: "Ctrl+,",
    category: "navigation",
    defaultCombo: { code: "Comma", ctrl: true, shift: false, alt: false },
    action: (a) => a.openSettings(),
  },
  {
    id: "quick-search",
    label: "Quick Search",
    defaultKeys: "Ctrl+P",
    category: "navigation",
    defaultCombo: { code: "KeyP", ctrl: true, shift: false, alt: false },
    action: (a) => a.openSearch(),
  },
  {
    id: "open-search-in-code",
    label: "Search in Code",
    defaultKeys: "Ctrl+Shift+F",
    category: "search",
    defaultCombo: { code: "KeyF", ctrl: true, shift: true, alt: false },
    action: (a) => a.openSearchInCode(),
  },
  {
    id: "search-toggle-match-case",
    label: "Search: Toggle Match Case",
    defaultKeys: "Ctrl+D",
    category: "search",
    defaultCombo: { code: "KeyD", ctrl: true, shift: false, alt: false },
    action: (a) => a.searchToggleMatchCase(),
  },
  {
    id: "search-toggle-whole-word",
    label: "Search: Toggle Whole Word",
    defaultKeys: "Ctrl+Alt+W",
    category: "search",
    defaultCombo: { code: "KeyW", ctrl: true, shift: false, alt: true },
    action: (a) => a.searchToggleWholeWord(),
  },
  {
    id: "search-toggle-regex",
    label: "Search: Toggle Regex",
    defaultKeys: "Ctrl+Alt+R",
    category: "search",
    defaultCombo: { code: "KeyR", ctrl: true, shift: false, alt: true },
    action: (a) => a.searchToggleRegex(),
  },
  {
    id: "search-toggle-replace",
    label: "Search: Toggle Replace Panel",
    defaultKeys: "Ctrl+H",
    category: "search",
    defaultCombo: { code: "KeyH", ctrl: true, shift: false, alt: false },
    action: (a) => a.searchToggleReplace(),
  },
  {
    id: "search-toggle-filters",
    label: "Search: Toggle Filters",
    defaultKeys: "Ctrl+Shift+I",
    category: "search",
    defaultCombo: { code: "KeyI", ctrl: true, shift: true, alt: false },
    action: (a) => a.searchToggleFilters(),
  },
  {
    id: "search-toggle-tree",
    label: "Search: Toggle Tree View",
    defaultKeys: "Ctrl+Shift+T",
    category: "search",
    defaultCombo: { code: "KeyT", ctrl: true, shift: true, alt: false },
    action: (a) => a.searchToggleTree(),
  },
  {
    id: "search-refresh",
    label: "Search: Refresh",
    defaultKeys: "Ctrl+R",
    category: "search",
    defaultCombo: { code: "KeyR", ctrl: true, shift: false, alt: false },
    action: (a) => a.searchRefresh(),
  },
  {
    id: "search-clear",
    label: "Search: Clear",
    defaultKeys: "Ctrl+Backspace",
    category: "search",
    defaultCombo: { code: "Backspace", ctrl: true, shift: false, alt: false },
    action: (a) => a.searchClear(),
  },
  {
    id: "focus-input",
    label: "Focus Input",
    defaultKeys: "/",
    category: "navigation",
    defaultCombo: { code: "Slash", ctrl: false, shift: false, alt: false },
    action: (a) => {
      if (!isInputFocused()) a.focusInput();
    },
  },

  // Chat
  {
    id: "new-chat",
    label: "New Chat",
    defaultKeys: "Ctrl+N",
    category: "chat",
    defaultCombo: { code: "KeyN", ctrl: true, shift: false, alt: false },
    action: (a) => a.newChat(),
  },
  {
    id: "next-chat",
    label: "Next Chat",
    defaultKeys: "Ctrl+Tab",
    category: "chat",
    defaultCombo: { code: "Tab", ctrl: true, shift: false, alt: false },
    action: (a) => a.switchChat("next"),
  },
  {
    id: "prev-chat",
    label: "Previous Chat",
    defaultKeys: "Ctrl+Shift+Tab",
    category: "chat",
    defaultCombo: { code: "Tab", ctrl: true, shift: true, alt: false },
    action: (a) => a.switchChat("prev"),
  },
  {
    id: "clear-chat",
    label: "Clear Chat",
    defaultKeys: "Ctrl+L",
    category: "chat",
    defaultCombo: { code: "KeyL", ctrl: true, shift: false, alt: false },
    action: (a) => a.clearChat(),
  },

  // Workspace
  {
    id: "toggle-chat-side",
    label: "Toggle Chat Sidebar",
    defaultKeys: "Ctrl+B",
    category: "workspace",
    defaultCombo: { code: "KeyB", ctrl: true, shift: false, alt: false },
    action: (a) => a.toggleChatSide(),
  },
  {
    id: "toggle-terminal",
    label: "Toggle Terminal",
    defaultKeys: "Ctrl+`",
    category: "workspace",
    defaultCombo: { code: "Backquote", ctrl: true, shift: false, alt: false },
    action: (a) => a.toggleTerminal(),
  },
  {
    id: "toggle-file-tree",
    label: "Toggle File Tree",
    defaultKeys: "Ctrl+Shift+E",
    category: "workspace",
    defaultCombo: { code: "KeyE", ctrl: true, shift: true, alt: false },
    action: (a) => a.toggleFileTree(),
  },

  // Terminal
  {
    id: "new-terminal",
    label: "New Terminal",
    defaultKeys: "Ctrl+Shift+T",
    category: "terminal",
    defaultCombo: { code: "KeyT", ctrl: true, shift: true, alt: false },
    action: (a) => {
      a.toggleTerminal();
      a.newTerminal();
    },
  },
  {
    id: "next-terminal",
    label: "Next Terminal Tab",
    defaultKeys: "Ctrl+Shift+]",
    category: "terminal",
    defaultCombo: { code: "BracketRight", ctrl: true, shift: true, alt: false },
    action: (a) => a.switchTerminal("next"),
  },
  {
    id: "prev-terminal",
    label: "Previous Terminal Tab",
    defaultKeys: "Ctrl+Shift+[",
    category: "terminal",
    defaultCombo: { code: "BracketLeft", ctrl: true, shift: true, alt: false },
    action: (a) => a.switchTerminal("prev"),
  },
  {
    id: "close-terminal",
    label: "Close Terminal Tab",
    defaultKeys: "Ctrl+Shift+X",
    category: "terminal",
    defaultCombo: { code: "KeyX", ctrl: true, shift: true, alt: false },
    action: (a) => a.closeTerminal(),
  },

  // Project
  {
    id: "new-project",
    label: "New Project",
    defaultKeys: "Ctrl+Shift+N",
    category: "project",
    defaultCombo: { code: "KeyN", ctrl: true, shift: true, alt: false },
    action: (a) => a.newProject(),
  },
  {
    id: "close-project",
    label: "Close Project",
    defaultKeys: "Ctrl+Shift+W",
    category: "project",
    defaultCombo: { code: "KeyW", ctrl: true, shift: true, alt: false },
    action: (a) => a.closeProject(),
  },
  ...Array.from({ length: 10 }, (_, i) => {
    const digit = (i + 1) % 10;
    return {
      id: `pick-project-${i + 1}`,
      label: `Project ${i + 1}`,
      defaultKeys: `Alt+${digit}`,
      category: "project" as const,
      defaultCombo: { code: `Digit${digit}`, ctrl: false, shift: false, alt: true },
      action: (a: ShortcutActions) => a.pickProject(i),
    };
  }),

  // Editor
  {
    id: "close-file",
    label: "Close File",
    defaultKeys: "Ctrl+W",
    category: "editor",
    defaultCombo: { code: "KeyW", ctrl: true, shift: false, alt: false },
    action: (a) => a.closeActiveFile(),
  },
  {
    id: "next-file",
    label: "Next File",
    defaultKeys: "Ctrl+PageDown",
    category: "editor",
    defaultCombo: { code: "PageDown", ctrl: true, shift: false, alt: false },
    action: (a) => a.cycleFileTab("next"),
  },
  {
    id: "prev-file",
    label: "Previous File",
    defaultKeys: "Ctrl+PageUp",
    category: "editor",
    defaultCombo: { code: "PageUp", ctrl: true, shift: false, alt: false },
    action: (a) => a.cycleFileTab("prev"),
  },
];
