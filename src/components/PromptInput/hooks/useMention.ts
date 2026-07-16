import { useState, useCallback } from "react";
import type { MentionState } from "../types.js";

export function useMention(workspace: string) {
  const [mention, setMention] = useState<MentionState>({
    active: false,
    start: -1,
    query: "",
    selected: 0,
    matches: [],
    loading: false,
  });

  const recomputeMention = useCallback(
    (text: string, caret: number) => {
      let i = caret - 1;
      while (i >= 0) {
        const ch = text[i]!;
        if (ch === "@") break;
        if (/[\s,;:]/.test(ch)) {
          setMention((m) => (m.active ? { ...m, active: false, matches: [] } : m));
          return;
        }
        i--;
      }
      if (i < 0) {
        setMention((m) => (m.active ? { ...m, active: false, matches: [] } : m));
        return;
      }
      const before = i === 0 ? "" : text[i - 1]!;
      if (before && !/\s/.test(before)) {
        setMention((m) => (m.active ? { ...m, active: false, matches: [] } : m));
        return;
      }
      const query = text.slice(i + 1, caret);
      setMention((prev) => ({
        ...prev,
        active: true,
        start: i,
        query,
        selected: 0,
        loading: true,
      }));
      window.vibe.fs.find(workspace, query, 30).then((res) => {
        setMention((prev) => {
          if (!prev.active || prev.start !== i || prev.query !== query) return prev;
          if (!res.ok) return { ...prev, matches: [], loading: false };
          return { ...prev, matches: res.matches, loading: false };
        });
      });
    },
    [workspace],
  );

  const closeMention = useCallback(() => {
    setMention((m) => (m.active ? { ...m, active: false, matches: [] } : m));
  }, []);

  const setMentionSelected = useCallback((index: number) => {
    setMention((s) => ({ ...s, selected: index }));
  }, []);

  return {
    mention,
    setMention,
    recomputeMention,
    closeMention,
    setMentionSelected,
  };
}
