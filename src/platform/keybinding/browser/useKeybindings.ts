// Shortcut application hook: matches key events against bindings, persists
// user overrides, and exposes the current binding list for the settings UI.
import { useCallback, useEffect, useRef, useState } from "react";
import { appState } from "@/platform/storage/common/keyValueStore";
import type { KeyCombo, ShortcutActions, ShortcutDef } from "../common/keybinding";
import { DEFAULT_BINDINGS } from "./defaultKeybindings";
import { formatCombo, isInputFocused, matchCombo } from "./keybinding";

export type { KeyCombo, ShortcutActions, ShortcutCategory, ShortcutDef } from "../common/keybinding";
export { formatCombo } from "./keybinding";

let recordingId: string | null = null;

export function setRecording(id: string | null): void {
  recordingId = id;
}

export function useShortcuts(actions: ShortcutActions) {
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const [customCombos, setCustomCombos] = useState<Map<string, KeyCombo>>(new Map());

  useEffect(() => {
    const load = async () => {
      const map = new Map<string, KeyCombo>();
      for (const b of DEFAULT_BINDINGS) {
        try {
          const stored = await appState.get(`shortcut:${b.id}`);
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
          if (isInputFocused() && !combo.ctrl && !combo.alt) {
            continue;
          }
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
      if (!def) throw new Error(`Unknown shortcut: ${id}`);

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
      await appState.set(`shortcut:${id}`, JSON.stringify(combo));
    },
    [customCombos],
  );

  const resetBinding = useCallback(
    async (id: string) => {
      const next = new Map(customCombos);
      next.delete(id);
      setCustomCombos(next);
      await appState.set(`shortcut:${id}`, "");
    },
    [customCombos],
  );

  return { shortcuts, updateBinding, resetBinding };
}
