import type { FileMatch } from "../../../types.js";

const RECENT_KEY = "vibe:recent_file_mentions";
const MAX_RECENTS = 20;

export function getRecentMentions(): FileMatch[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (Array.isArray(list)) return list;
  } catch {
    /* ignore */
  }
  return [];
}

export function addRecentMention(match: FileMatch) {
  try {
    const list = getRecentMentions();
    const filtered = list.filter((item) => item.path !== match.path);
    const updated = [match, ...filtered].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    /* ignore */
  }
}
