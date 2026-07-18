import type { ChatRecord } from "./types.js";

let nextLocalId = 0;
export const localId = (): string => `l${++nextLocalId}`;

/** Convert a saved ChatRecord into UI history items (best-effort, lossy). */
export function recordToItems(record: ChatRecord): any[] {
  const out: any[] = [];
  for (let i = 0; i < record.messages.length; i++) {
    const msg = record.messages[i]!;
    if (msg.role === "system") continue;
    if (msg.role === "user") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p) => (p.type === "text" ? p.text : "[image]")).join(" ")
            : "";
      out.push({ id: localId(), kind: "user", text, msgIndex: i });
    } else if (msg.role === "assistant") {
      const text =
        typeof msg.content === "string"
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map((p) => (p.type === "text" ? p.text : "")).join("")
            : "";
      if (text) {
        const item: any = { id: localId(), kind: "assistant", text, msgIndex: i };
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

/** Play a sound from public/sounds/ */
export function playAudio(filename: string) {
  const audio = new Audio(`sounds/${filename}`);
  audio.play().catch((e) => console.error("Audio play failed:", e));
}
