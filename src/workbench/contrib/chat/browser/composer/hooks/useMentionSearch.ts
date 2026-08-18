import { useCallback, useState } from "react";
import { fileService } from "@/workbench/services/files/tauri/fileService";
import type { MentionState } from "../../../common/chat";
import { getRecentMentions } from "../utils/recentMentions";

/**
 * State behind the @-mention popup: resolves the typed query against the
 * workspace file tree (falls back to recent mentions for an empty query).
 */
export function useMentionSearch(workspace: string) {
  const [mentionState, setMentionState] = useState<MentionState>({
    active: false,
    start: 0,
    query: "",
    selected: 0,
    matches: [],
    loading: false,
  });

  const closeMention = useCallback(
    () => setMentionState((m) => (m.active ? { ...m, active: false, matches: [] } : m)),
    [],
  );

  const setMentionSelected = useCallback((index: number) => setMentionState((s) => ({ ...s, selected: index })), []);

  /** Cyclically move the popup selection by one step, wrapping at the ends. */
  const moveSelected = useCallback((step: 1 | -1) => {
    setMentionState((s) => {
      const len = Math.max(s.matches.length, 1);
      return { ...s, selected: (s.selected + step + len) % len };
    });
  }, []);

  const onAtInput = useCallback(
    (query: string) => {
      setMentionState((prev) => ({ ...prev, active: true, selected: 0, loading: true }));
      if (!query.trim()) {
        const recents = getRecentMentions();
        if (recents.length > 0) {
          setMentionState((prev) => (!prev.active ? prev : { ...prev, matches: recents, loading: false }));
          return;
        }
      }
      fileService.findAll(workspace, query, 30).then((res) => {
        setMentionState((prev) =>
          !prev.active
            ? prev
            : !res.ok
              ? { ...prev, matches: [], loading: false }
              : { ...prev, matches: res.matches, loading: false },
        );
      });
    },
    [workspace],
  );

  return { mentionState, onAtInput, closeMention, setMentionSelected, moveSelected };
}
