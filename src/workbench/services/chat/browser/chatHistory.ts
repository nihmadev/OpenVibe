// Mapping of persisted chat records into agent history view items.

import { localId } from "@/base/common/localId";
import type { FileMentionView, HistoryItem } from "@/workbench/common/conversation";
import { fileService } from "@/workbench/services/files/tauri/fileService";
import type { ChatRecord } from "../common/chat";
import { migrateChatRecord } from "../common/chatMigrations";

const MENTION_RE = /@((?:[^\s@]*[/\\][^\s@]*)+)/g;

function normalizeMentionPath(value: string): string {
  return value.replace(/^@/, "").replace(/\\/g, "/").replace(/\/+$/, "");
}

/** Recover mention metadata that is not persisted in ChatMessage. */
export function mentionsFromText(text: string): FileMentionView[] {
  return Array.from(text.matchAll(MENTION_RE), (match) => {
    const display = match[1]!;
    return {
      display,
      path: display,
      isDir: display.endsWith("/") || display.endsWith("\\") ? true : undefined,
    };
  });
}

/** Resolve directory mentions in restored messages using the current workspace. */
export async function hydrateRestoredMentions(items: HistoryItem[], cwd: string): Promise<HistoryItem[]> {
  const candidates = items.flatMap((item) => (item.kind === "user" ? mentionsFromText(item.text) : []));
  if (candidates.length === 0) return items;

  const resolved = new Map<string, boolean>();
  await Promise.all(
    candidates.map(async (mention) => {
      const key = normalizeMentionPath(mention.display).toLowerCase();
      if (resolved.has(key)) return;
      const path = /^[A-Za-z]:[\\/]|^[\\/]/.test(mention.path)
        ? mention.path
        : `${cwd.replace(/[\\/]$/, "")}/${mention.path}`;
      const result = await fileService.list(path).catch(() => null);
      resolved.set(key, result?.ok === true);
    }),
  );

  return items.map((item) => {
    if (item.kind !== "user") return item;
    const mentions = mentionsFromText(item.text).map((mention) => ({
      ...mention,
      isDir: resolved.get(normalizeMentionPath(mention.display).toLowerCase()) ?? mention.isDir,
    }));
    return mentions.length > 0 ? { ...item, mentions } : item;
  });
}

/** Convert a saved ChatRecord into UI history items (best-effort, lossy). */
export function recordToItems(record: ChatRecord): HistoryItem[] {
  const migrated = migrateChatRecord(record);
  const out: HistoryItem[] = [];
  for (let i = 0; i < migrated.messages.length; i++) {
    const msg = migrated.messages[i]!;
    if (msg.role === "system") continue;
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p) => (p.type === "text" ? p.text : "[image]")).join(" ")
            : "";
      // Backend injects compaction summaries as user-role messages marked
      // with [context-compacted]. They are model-facing context, not user
      // input — skip them in the visible history.
      if (
        text.startsWith("[context-compacted]") ||
        text.startsWith("[earlier conversation trimmed") ||
        text.startsWith("[work-title-protocol-error]")
      ) {
        continue;
      }
      out.push({
        id: localId(),
        kind: "user",
        text,
        mentions: mentionsFromText(text),
        msgIndex: i,
      });
    } else if (msg.role === "assistant") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p) => (p.type === "text" ? p.text : "")).join("")
            : "";
      if (text || msg.reasoningContent || msg.reasoningName) {
        const item: HistoryItem = { id: localId(), kind: "assistant", text, msgIndex: i };
        if (msg.reasoningContent) {
          item.reasoning = msg.reasoningContent;
          item.reasoningDone = true;
        }
        if (msg.reasoningName) {
          item.reasoningName = msg.reasoningName;
        }
        out.push(item);
      }
      for (const tc of msg.toolCalls ?? []) {
        let parsed: unknown = {};
        try {
          parsed = tc.function.arguments ? JSON.parse(tc.function.arguments) : {};
        } catch {
          parsed = tc.function.arguments;
        }
        out.push({
          id: tc.id,
          kind: "tool",
          text: "",
          toolName: tc.function.name,
          toolArgs: parsed,
          msgIndex: i,
        });
      }
    } else if (msg.role === "tool") {
      const idx = out.findIndex((it) => it.kind === "tool" && it.id === msg.toolCallId);
      if (idx >= 0) {
        const text =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content.map((p) => (p.type === "text" ? p.text : "")).join("")
              : "";
        // Backend keeps failed tool results in the conversation as a hint for
        // the model, marked with [tool-error]. Do not resurrect those calls in
        // the user-facing history when loading a saved chat.
        if (text.startsWith("[tool-error]")) {
          out.splice(idx, 1);
          continue;
        }
        out[idx] = { ...out[idx]!, text, ok: true, msgIndex: i };
      }
    }
  }
  return out;
}
