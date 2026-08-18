import type { ChatSummary } from "./chat";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface DateGroup<T = ChatSummary> {
  key: string;
  labelId: "today" | "yesterday" | "last7Days" | "last30Days" | "older";
  items: T[];
}

function getStartOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Groups sessions into chronological buckets (Today, Yesterday, Last 7 days, Last 30 days, Older).
 */
export function groupSessionsByDate<T>(
  items: T[],
  sortBy: "last_updated" | "date_added" | "alphabetical" = "last_updated",
  now: number = Date.now(),
  getTimestamp?: (item: T) => number,
): DateGroup<T>[] {
  const todayStart = getStartOfDay(now);
  const groupsMap = new Map<string, DateGroup<T>>();

  const bucketKeys: Array<{ key: string; labelId: DateGroup["labelId"] }> = [
    { key: "today", labelId: "today" },
    { key: "yesterday", labelId: "yesterday" },
    { key: "last7Days", labelId: "last7Days" },
    { key: "last30Days", labelId: "last30Days" },
    { key: "older", labelId: "older" },
  ];

  for (const b of bucketKeys) {
    groupsMap.set(b.key, { key: b.key, labelId: b.labelId, items: [] });
  }

  for (const item of items) {
    let timestamp = 0;
    if (getTimestamp) {
      timestamp = getTimestamp(item);
    } else {
      const anyItem = item as any;
      const target = anyItem.chat || anyItem;
      timestamp = sortBy === "date_added" ? (target.createdAt ?? 0) : (target.updatedAt ?? target.createdAt ?? 0);
    }
    const itemDay = getStartOfDay(timestamp);
    const daysAgo = Math.floor((todayStart - itemDay) / DAY_MS);

    let bucket = "older";
    if (daysAgo <= 0) {
      bucket = "today";
    } else if (daysAgo === 1) {
      bucket = "yesterday";
    } else if (daysAgo <= 7) {
      bucket = "last7Days";
    } else if (daysAgo <= 30) {
      bucket = "last30Days";
    } else {
      bucket = "older";
    }

    groupsMap.get(bucket)!.items.push(item);
  }

  // Return only non-empty groups
  return bucketKeys.map((b) => groupsMap.get(b.key)!).filter((group) => group.items.length > 0);
}
