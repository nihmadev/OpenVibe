import { useEffect, useState } from "react";

// ZCode plays the stream-in fade only the first time a tool block enters the
// timeline. The timeline is virtualized and rows remount while scrolling, so
// "first time" is tracked in a module-level LRU set of tool ids — remounts of
// already-seen blocks render without the entrance animation.

const SEEN_LIMIT = 800;

const seenToolIds = new Map<string, number>();

function pruneSeen() {
  if (seenToolIds.size <= SEEN_LIMIT) return;
  const oldest = Array.from(seenToolIds.entries())
    .sort(([, a], [, b]) => a - b)
    .slice(0, seenToolIds.size - SEEN_LIMIT)
    .map(([id]) => id);
  for (const id of oldest) seenToolIds.delete(id);
}

/**
 * Returns true while the tool block should animate its entrance
 * (first appearance only).
 */
export function useToolEntrance(toolId: string, enabled: boolean): boolean {
  const [isNew] = useState(() => enabled && !seenToolIds.has(toolId));

  useEffect(() => {
    seenToolIds.set(toolId, Date.now());
    pruneSeen();
  }, [toolId]);

  return isNew;
}
