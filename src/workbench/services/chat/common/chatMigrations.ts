// Normalization of chat records persisted by older app versions into the
// current ChatMessage shape, so restored chats render through the current
// timeline design instead of whatever their original schema implied.
import type { ChatMessage, ChatRecord } from "./chat";

/** Bump when ChatMessage/ChatRecord semantics change; add a step below. */
export const CHAT_SCHEMA_VERSION = 2;

type UnknownRecord = Record<string, unknown>;

const isObj = (value: unknown): value is UnknownRecord => typeof value === "object" && value !== null;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Step 1 → 2: accept pre-camelCase agent payloads and legacy field names.
 * Older records may carry snake_case keys (tool_call_id, reasoning_content),
 * a single `tool_call` instead of `toolCalls`, or non-normalized roles.
 */
function migrateToV2(message: ChatMessage, index: number): ChatMessage | null {
  const raw = message as unknown as UnknownRecord;
  const role = str(raw.role);
  let normalizedRole = message.role;
  if (role === "function") {
    normalizedRole = "tool";
  } else if (role !== "system" && role !== "user" && role !== "assistant" && role !== "tool") {
    // Unknown role from a future or ancient schema — keep it visible as user
    // text when possible, otherwise drop the message.
    const text = str(typeof message.content === "string" ? message.content : null);
    if (role && text) return { role: "user", content: text };
    return null;
  }

  const migrated: ChatMessage = { ...message, role: normalizedRole };

  // snake_case / legacy tool-result linkage
  const toolCallId = str(raw.toolCallId) ?? str(raw.tool_call_id) ?? str(raw.toolCallID);
  if (toolCallId && !migrated.toolCallId) migrated.toolCallId = toolCallId;

  // reasoning fields
  if (!migrated.reasoningContent) {
    const legacy = str(raw.reasoning_content) ?? str(raw.reasoning);
    if (legacy) migrated.reasoningContent = legacy;
  }
  if (!migrated.reasoningName) {
    const legacy = str(raw.reasoning_name) ?? str(raw.thinkingName);
    if (legacy) migrated.reasoningName = legacy;
  }

  // legacy single tool call → toolCalls array
  if (!migrated.toolCalls && (isObj(raw.tool_call) || Array.isArray(raw.tool_calls))) {
    const calls = Array.isArray(raw.tool_calls) ? raw.tool_calls : [raw.tool_call];
    const toolCalls = calls
      .map((call) => {
        if (!isObj(call)) return null;
        const fn = isObj(call.function) ? call.function : call;
        const id = str(call.id) ?? `legacy-${index}`;
        const name = str(fn.name);
        if (!name) return null;
        const args = fn.arguments;
        return {
          id,
          type: "function" as const,
          function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args ?? {}) },
        };
      })
      .filter((call): call is NonNullable<typeof call> => call !== null);
    if (toolCalls.length > 0) {
      migrated.toolCalls = toolCalls;
      if (normalizedRole === "assistant" && migrated.content === null) migrated.content = "";
    }
  }

  // normalize null content for assistant/tool rows so downstream mapping
  // doesn't have to special-case missing payloads
  if (migrated.content === null && (normalizedRole === "assistant" || normalizedRole === "tool")) {
    migrated.content = "";
  }

  return migrated;
}

const MIGRATIONS: Array<(message: ChatMessage, index: number) => ChatMessage | null> = [migrateToV2];

/**
 * Bring any persisted record up to the current schema. Idempotent: records
 * already at CHAT_SCHEMA_VERSION pass through untouched (cheap reference
 * equality), older ones are normalized once on open.
 */
export function migrateChatRecord(record: ChatRecord): ChatRecord {
  if (record.schemaVersion === CHAT_SCHEMA_VERSION) return record;

  const messages: ChatMessage[] = [];
  record.messages.forEach((message, index) => {
    let current: ChatMessage | null = message;
    for (const step of MIGRATIONS) {
      if (current === null) break;
      current = step(current, index);
    }
    if (current !== null) messages.push(current);
  });

  return { ...record, schemaVersion: CHAT_SCHEMA_VERSION, messages };
}
