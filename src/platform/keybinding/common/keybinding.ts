/** Functional categorizations for application keyboard shortcuts. */
export type ShortcutCategory = "navigation" | "chat" | "workspace" | "project" | "editor" | "terminal" | "search";

/** Represents a combination of modifier key flags and a physical key code. */
export interface KeyCombo {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

/** Describes a registered shortcut entry for display in keybinding preferences. */
export interface ShortcutDef {
  id: string;
  label: string;
  keys: string;
  category: ShortcutCategory;
}

/** Workbench actions addressed by the default keybinding registry. */
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

/** A default keybinding and the action it dispatches. */
export interface BindingDef {
  id: string;
  label: string;
  defaultKeys: string;
  category: ShortcutCategory;
  defaultCombo: KeyCombo;
  action: (actions: ShortcutActions) => void;
}
