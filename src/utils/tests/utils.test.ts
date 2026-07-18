import { describe, it, expect } from "vitest";
import { localId, recordToItems } from "../../utils";
import type { ChatRecord } from "../../types";

describe("localId", () => {
  it("generates sequential IDs with l prefix", () => {
    expect(localId()).toBe("l1");
    expect(localId()).toBe("l2");
    expect(localId()).toBe("l3");
  });
});

describe("recordToItems", () => {
  it("returns empty array for empty messages", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [],
    };
    expect(recordToItems(record)).toEqual([]);
  });

  it("skips system messages", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [{ role: "system", content: "be helpful" }],
    };
    expect(recordToItems(record)).toEqual([]);
  });

  it("converts a user message with string content", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [{ role: "user", content: "hello" }],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "user", text: "hello", msgIndex: 0 });
    expect(items[0].id).toMatch(/^l\d+$/);
  });

  it("converts user message with ContentPart[] content", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "describe this " },
            { type: "image_url", image_url: { url: "data:image/png;base64,x" } },
          ],
        },
      ],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("describe this  [image]");
  });

  it("converts user message with null content", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [{ role: "user", content: null }],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("");
  });

  it("converts assistant message with text", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [{ role: "assistant", content: "hi there" }],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: "assistant", text: "hi there" });
  });

  it("converts assistant message with reasoningContent", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "assistant",
          content: "answer",
          reasoningContent: "thinking...",
        },
      ],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "assistant",
      text: "answer",
      reasoning: "thinking...",
      reasoningDone: true,
    });
  });

  it("converts assistant message with reasoningContent and reasoningName", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "assistant",
          content: "answer",
          reasoningContent: "thinking...",
          reasoningName: "Investigate build error...",
        },
      ],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "assistant",
      text: "answer",
      reasoning: "thinking...",
      reasoningDone: true,
      reasoningName: "Investigate build error...",
    });
  });

  it("skips assistant message with empty text", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [{ role: "assistant", content: "" }],
    };
    expect(recordToItems(record)).toEqual([]);
  });

  it("converts assistant tool calls", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tc1",
              type: "function",
              function: { name: "read_file", arguments: JSON.stringify({ path: "/x" }) },
            },
          ],
        },
      ],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "tc1",
      kind: "tool",
      toolName: "read_file",
      toolArgs: { path: "/x" },
      msgIndex: 0,
    });
  });

  it("handles tool call with unparseable arguments", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tc2",
              type: "function",
              function: { name: "bash", arguments: "not-json" },
            },
          ],
        },
      ],
    };
    const items = recordToItems(record);
    expect(items[0].toolArgs).toBe("not-json");
  });

  it("pairs tool result with its tool call", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tc3",
              type: "function",
              function: { name: "bash", arguments: "{}" },
            },
          ],
        },
        { role: "tool", content: "done", toolCallId: "tc3" },
      ],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "tc3", text: "done", ok: true });
  });

  it("hides failed tool results while restoring history", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tc-failed",
              type: "function",
              function: { name: "read_file", arguments: '{"path":"missing"}' },
            },
          ],
        },
        { role: "tool", content: "[tool-error] Tool execution failed. Hint: missing", toolCallId: "tc-failed" },
      ],
    };
    expect(recordToItems(record)).toEqual([]);
  });

  it("ignores tool result with no matching tool call", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [{ role: "tool", content: "orphan", toolCallId: "nonexistent" }],
    };
    const items = recordToItems(record);
    expect(items).toHaveLength(0);
  });

  it("handles mixed conversation", () => {
    const record: ChatRecord = {
      id: "1",
      title: "test",
      createdAt: 0,
      updatedAt: 0,
      messages: [
        { role: "system", content: "be helpful" },
        { role: "user", content: "list files" },
        {
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "tc4",
              type: "function",
              function: { name: "bash", arguments: '{"command":"ls"}' },
            },
          ],
        },
        { role: "tool", content: "file1\nfile2", toolCallId: "tc4" },
        { role: "assistant", content: "done!" },
      ],
    };
    const items = recordToItems(record);
    // user + tool(paired) + assistant = 3 items (system skipped)
    expect(items).toHaveLength(3);
    expect(items[0].kind).toBe("user");
    expect(items[1]).toMatchObject({ kind: "tool", text: "file1\nfile2", ok: true });
    expect(items[2]).toMatchObject({ kind: "assistant", text: "done!" });
  });
});
