import { describe, expect, it } from "vitest";
import type { ChatRecord } from "./chat";
import { CHAT_SCHEMA_VERSION, migrateChatRecord } from "./chatMigrations";

function legacyRecord(messages: unknown[]): ChatRecord {
  return {
    id: "1",
    title: "legacy",
    createdAt: 0,
    updatedAt: 0,
    messages: messages as ChatRecord["messages"],
  };
}

describe("migrateChatRecord", () => {
  it("stamps the current schema version", () => {
    const migrated = migrateChatRecord(legacyRecord([]));
    expect(migrated.schemaVersion).toBe(CHAT_SCHEMA_VERSION);
  });

  it("passes already-migrated records through untouched", () => {
    const record: ChatRecord = {
      id: "1",
      title: "current",
      createdAt: 0,
      updatedAt: 0,
      schemaVersion: CHAT_SCHEMA_VERSION,
      messages: [{ role: "user", content: "hi" }],
    };
    expect(migrateChatRecord(record)).toBe(record);
  });

  it("maps legacy snake_case tool linkage to toolCallId", () => {
    const migrated = migrateChatRecord(
      legacyRecord([
        { role: "tool", content: "result", tool_call_id: "call-1" } as unknown as ChatRecord["messages"][number],
      ]),
    );
    expect(migrated.messages[0]).toMatchObject({ role: "tool", content: "result", toolCallId: "call-1" });
  });

  it("converts a legacy single tool_call into toolCalls", () => {
    const migrated = migrateChatRecord(
      legacyRecord([
        {
          role: "assistant",
          content: null,
          tool_call: { id: "call-2", function: { name: "edit_file", arguments: '{"path":"a.ts"}' } },
        } as unknown as ChatRecord["messages"][number],
      ]),
    );
    expect(migrated.messages[0]?.toolCalls).toEqual([
      { id: "call-2", type: "function", function: { name: "edit_file", arguments: '{"path":"a.ts"}' } },
    ]);
    expect(migrated.messages[0]?.content).toBe("");
  });

  it("normalizes legacy reasoning fields", () => {
    const migrated = migrateChatRecord(
      legacyRecord([
        {
          role: "assistant",
          content: "done",
          reasoning_content: "thinking...",
          reasoning_name: "Plan",
        } as unknown as ChatRecord["messages"][number],
      ]),
    );
    expect(migrated.messages[0]).toMatchObject({ reasoningContent: "thinking...", reasoningName: "Plan" });
  });

  it("maps the legacy function role to tool", () => {
    const migrated = migrateChatRecord(
      legacyRecord([{ role: "function", content: "output" } as unknown as ChatRecord["messages"][number]]),
    );
    expect(migrated.messages[0]?.role).toBe("tool");
  });

  it("drops messages with unknown roles and no recoverable text", () => {
    const migrated = migrateChatRecord(
      legacyRecord([{ role: "future_role" } as unknown as ChatRecord["messages"][number]]),
    );
    expect(migrated.messages).toHaveLength(0);
  });
});
