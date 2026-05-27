import type { Attachment } from "./types.js"

export const MAX_HISTORY = 100

export interface HistoryEntry {
  text: string
  attachments: Attachment[]
}

export function canNavigateHistoryAtCursor(
  direction: "up" | "down",
  text: string,
  cursor: number,
  inHistory: boolean,
) {
  const position = Math.max(0, Math.min(cursor, text.length))
  const atStart = position === 0
  const atEnd = position === text.length
  if (inHistory) return atStart || atEnd
  if (direction === "up") return position === 0 && text.length === 0
  return position === text.length
}

export function prependHistoryEntry(
  entries: HistoryEntry[],
  text: string,
  attachments: Attachment[],
  max = MAX_HISTORY,
): HistoryEntry[] {
  const hasImages = attachments.some((a) => a.kind === "image")
  const hasFiles = attachments.some((a) => a.kind === "file")
  if (!text.trim() && !hasImages && !hasFiles) return entries

  const entry: HistoryEntry = { text, attachments: attachments.slice() }
  const last = entries[0]
  if (last && last.text === text) return entries
  return [entry, ...entries].slice(0, max)
}

type NavInput = {
  direction: "up" | "down"
  entries: HistoryEntry[]
  historyIndex: number
  currentText: string
  savedText: string | null
}

type NavResult =
  | { handled: false }
  | {
      handled: true
      historyIndex: number
      savedText: string | null
      entry: HistoryEntry
      cursor: "start" | "end"
    }

export function navigatePromptHistory(input: NavInput): NavResult {
  if (input.direction === "up") {
    if (input.entries.length === 0) return { handled: false }

    if (input.historyIndex === -1) {
      return {
        handled: true,
        historyIndex: 0,
        savedText: input.currentText,
        entry: input.entries[0]!,
        cursor: "start",
      }
    }

    if (input.historyIndex < input.entries.length - 1) {
      return {
        handled: true,
        historyIndex: input.historyIndex + 1,
        savedText: input.savedText,
        entry: input.entries[input.historyIndex + 1]!,
        cursor: "start",
      }
    }

    return { handled: false }
  }

  if (input.historyIndex > 0) {
    return {
      handled: true,
      historyIndex: input.historyIndex - 1,
      savedText: input.savedText,
      entry: input.entries[input.historyIndex - 1]!,
      cursor: "end",
    }
  }

  if (input.historyIndex === 0) {
    return {
      handled: true,
      historyIndex: -1,
      savedText: null,
      entry: { text: input.savedText ?? "", attachments: [] },
      cursor: "end",
    }
  }

  return { handled: false }
}
