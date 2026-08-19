// Keyboard shortcut model: combo types, formatting, and matching.
import type { KeyCombo } from "../common/keybinding";

export type { KeyCombo, ShortcutCategory, ShortcutDef } from "../common/keybinding";

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

export function matchCombo(e: KeyboardEvent, combo: KeyCombo): boolean {
  if (combo.ctrl !== (e.ctrlKey || e.metaKey)) return false;
  if (combo.shift !== e.shiftKey) return false;
  if (combo.alt !== e.altKey) return false;
  return e.code === combo.code;
}

export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || (el as HTMLElement).isContentEditable;
}
