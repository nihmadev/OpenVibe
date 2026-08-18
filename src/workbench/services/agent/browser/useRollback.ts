// Rollback (instant revert) use case: revert conversation to a message index
// and allow restoring the removed items.
import { useCallback, useState } from "react";
import type { HistoryItem } from "@/workbench/common/conversation";
import type { FileSnapshot } from "../common/agentFileChanges";
import { agentService } from "../tauri/agentService";

export function useRollback(setItems: React.Dispatch<React.SetStateAction<HistoryItem[]>>) {
  const [rollbackIndex, setRollbackIndex] = useState<number | null>(null);
  const [rollbackText, setRollbackText] = useState("");
  const [rollbackRemovedItems, setRollbackRemovedItems] = useState<HistoryItem[]>([]);
  const [rollbackChanged, setRollbackChanged] = useState<FileSnapshot[]>([]);
  const [rollbackRemoved, setRollbackRemoved] = useState(0);

  const clearRollback = useCallback(() => {
    setRollbackIndex(null);
    setRollbackText("");
    setRollbackRemovedItems([]);
    setRollbackChanged([]);
    setRollbackRemoved(0);
  }, []);

  const revertToItem = useCallback(
    async (items: HistoryItem[], id: string) => {
      const idx = items.findIndex((it) => it.id === id);
      if (idx < 0) return;
      const item = items[idx]!;
      if (item.msgIndex === undefined) return;

      try {
        const result = await agentService.instantRevert(item.msgIndex);
        const removed = items.slice(idx);
        setRollbackRemovedItems(removed);
        setItems((prev) => prev.slice(0, idx));
        setRollbackIndex(item.msgIndex);
        setRollbackText(item.text);
        setRollbackChanged(result.filesChanged);
        const removedUserCount = removed.filter((it) => it.kind === "user").length;
        setRollbackRemoved(removedUserCount);
      } catch {
        // revert failed silently
      }
    },
    [setItems],
  );

  const undoRollback = useCallback(async () => {
    if (rollbackIndex === null) return;
    try {
      await agentService.revertUndo();
    } catch {
      /* ignore */
    }
    setItems((prev) => [...prev, ...rollbackRemovedItems]);
    clearRollback();
  }, [rollbackIndex, rollbackRemovedItems, clearRollback, setItems]);

  return {
    rollbackIndex,
    rollbackText,
    rollbackChanged,
    rollbackRemoved,
    clearRollback,
    revertToItem,
    undoRollback,
  };
}
