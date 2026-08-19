// Streaming agent events emitted by the Rust backend (owned by the agent feature).
import type { BrowserEvent } from "@/workbench/contrib/browser/common/browser";

export type AgentEvent =
  | { kind: "user"; text: string; index?: number }
  | { kind: "assistant-start" }
  | { kind: "assistant-chunk"; text: string }
  | { kind: "assistant-end" }
  | { kind: "tool-call"; id: string; name: string; args: unknown }
  | { kind: "tool-chunk"; id: string; args: string; delta?: boolean }
  | { kind: "tool-result"; id: string; ok: boolean; text: string }
  | { kind: "tool-denied"; id: string; name: string }
  | { kind: "reasoning-start"; name?: string }
  | { kind: "reasoning-chunk"; text: string; name?: string }
  | { kind: "reasoning-end" }
  | { kind: "info"; text: string }
  | { kind: "stopped" }
  | { kind: "error"; text: string }
  | { kind: "browser"; event: BrowserEvent }
  | { kind: "done" };
