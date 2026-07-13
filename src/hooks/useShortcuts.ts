import { useEffect, useRef, useState, useCallback } from "react";

export type ShortcutCategory = "navigation" | "chat" | "workspace" | "project" | "editor" | "terminal" | "search";

export interface KeyCombo {
  code: string;
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
}

export interface ShortcutDef {
  id: string;
  label: string;
  keys: string;
  category: ShortcutCategory;
}

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

interface BindingDef {
  id: string;
  label: string;
  defaultKeys: string;
  category: ShortcutCategory;
  defaultCombo: KeyCombo;
  action: (actions: ShortcutActions) => void;
}

let recordingId: string | null = null;

export function setRecording(id: string | null): void {
  recordingId = id;
}

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}

function formatCode(code: string): string {
  const map: Record<string, string> = {
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backquote: "`",
    Semicolon: ";",
    Quote: "'",
    Backslash: "\\",
    BracketLeft: "[",
    BracketRight: "]",
    Minus: "-",
    Equal: "=",
    Space: "Space",
    Tab: "Tab",
    Enter: "Enter",
    Escape: "Esc",
    ArrowUp: "\u2191",
    ArrowDown: "\u2193",
    ArrowLeft: "\u2190",
    ArrowRight: "\u2192",
    PageUp: "PageUp",
    PageDown: "PageDown",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

export function formatCombo(c: KeyCombo): string {
  const parts: string[] = [];
  if (c.ctrl) parts.push("Ctrl");
  if (c.alt) parts.push("Alt");
  if (c.shift) parts.push("Shift");
  parts.push(formatCode(c.code));
  return parts.join("+");
}

function matchCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  if (combo.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (combo.shift !== e.shiftKey) return false;
  if (combo.alt !== e.altKey) return false;
  return e.code === combo.code;
}

const MODIFIER_CODES = new Set([
  "ControlLeft",
  "ControlRight",
  "ShiftLeft",
  "ShiftRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

const DEFAULT_BINDINGS: BindingDef[] = [
  // ── Navigation ──
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

  // ── Chat ──
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

  // ── Workspace ──
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

  // ── Terminal ──
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

  // ── Project ──
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
  {
    id: "pick-project-1",
    label: "Project 1",
    defaultKeys: "Alt+1",
    category: "project",
    defaultCombo: { code: "Digit1", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(0),
  },
  {
    id: "pick-project-2",
    label: "Project 2",
    defaultKeys: "Alt+2",
    category: "project",
    defaultCombo: { code: "Digit2", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(1),
  },
  {
    id: "pick-project-3",
    label: "Project 3",
    defaultKeys: "Alt+3",
    category: "project",
    defaultCombo: { code: "Digit3", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(2),
  },
  {
    id: "pick-project-4",
    label: "Project 4",
    defaultKeys: "Alt+4",
    category: "project",
    defaultCombo: { code: "Digit4", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(3),
  },
  {
    id: "pick-project-5",
    label: "Project 5",
    defaultKeys: "Alt+5",
    category: "project",
    defaultCombo: { code: "Digit5", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(4),
  },
  {
    id: "pick-project-6",
    label: "Project 6",
    defaultKeys: "Alt+6",
    category: "project",
    defaultCombo: { code: "Digit6", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(5),
  },
  {
    id: "pick-project-7",
    label: "Project 7",
    defaultKeys: "Alt+7",
    category: "project",
    defaultCombo: { code: "Digit7", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(6),
  },
  {
    id: "pick-project-8",
    label: "Project 8",
    defaultKeys: "Alt+8",
    category: "project",
    defaultCombo: { code: "Digit8", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(7),
  },
  {
    id: "pick-project-9",
    label: "Project 9",
    defaultKeys: "Alt+9",
    category: "project",
    defaultCombo: { code: "Digit9", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(8),
  },
  {
    id: "pick-project-10",
    label: "Project 10",
    defaultKeys: "Alt+0",
    category: "project",
    defaultCombo: { code: "Digit0", ctrl: false, shift: false, alt: true },
    action: (a) => a.pickProject(9),
  },

  // ── Editor ──
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

export function useShortcuts(actions: ShortcutActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const [customCombos, setCustomCombos] = useState<Map<string, KeyCombo>>(new Map());

  useEffect(() => {
    const load = async () => {
      const map = new Map<string, KeyCombo>();
      for (const b of DEFAULT_BINDINGS) {
        try {
          const stored = await window.vibe.state.get("shortcut:" + b.id);
          if (stored) {
            const parsed = JSON.parse(stored) as KeyCombo;
            if (parsed && typeof parsed.code === "string") {
              map.set(b.id, parsed);
            }
          }
        } catch {
          /* ignore */
        }
      }
      setCustomCombos(map);
    };
    load();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (recordingId) return;

      for (const b of DEFAULT_BINDINGS) {
        const combo = customCombos.get(b.id) ?? b.defaultCombo;
        if (matchCombo(e, combo)) {
          e.preventDefault();
          e.stopPropagation();
          b.action(actionsRef.current);
          return;
        }
      }
      if (e.key === "Escape") {
        actionsRef.current.closeSettings();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [customCombos]);

  const shortcuts: ShortcutDef[] = DEFAULT_BINDINGS.map((b) => {
    const combo = customCombos.get(b.id) ?? b.defaultCombo;
    return { id: b.id, label: b.label, keys: formatCombo(combo), category: b.category };
  });

  const updateBinding = useCallback(
    async (id: string, combo: KeyCombo) => {
      const def = DEFAULT_BINDINGS.find((b) => b.id === id);
      if (!def) throw new Error("Unknown shortcut: " + id);

      for (const b of DEFAULT_BINDINGS) {
        if (b.id === id) continue;
        const existing = customCombos.get(b.id) ?? b.defaultCombo;
        if (
          existing.code === combo.code &&
          existing.ctrl === combo.ctrl &&
          existing.shift === combo.shift &&
          existing.alt === combo.alt
        ) {
          throw new Error(
            `\u041a\u043e\u043d\u0444\u043b\u0438\u043a\u0442 \u0441 \u00ab${b.label}\u00bb (${formatCombo(existing)})`,
          );
        }
      }
      const next = new Map(customCombos);
      next.set(id, combo);
      setCustomCombos(next);
      await window.vibe.state.set("shortcut:" + id, JSON.stringify(combo));
    },
    [customCombos],
  );

  const resetBinding = useCallback(
    async (id: string) => {
      const next = new Map(customCombos);
      next.delete(id);
      setCustomCombos(next);
      await window.vibe.state.set("shortcut:" + id, "");
    },
    [customCombos],
  );

  return { shortcuts, updateBinding, resetBinding };
}
