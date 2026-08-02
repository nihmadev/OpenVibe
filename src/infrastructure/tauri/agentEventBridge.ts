// Bridges raw Tauri agent events into the typed AgentEvent stream.
import { listen } from "@tauri-apps/api/event";
import { addTauriUnlistenFn, emitBusy, emitEvent } from "./state";

interface UserPayload {
  text?: string;
  index?: number;
}
interface TextPayload {
  text?: string;
}
interface ReasoningPayload {
  text?: string;
  name?: string;
}
interface ToolCallPayload {
  id?: string;
  name?: string;
  args?: unknown;
}
interface ToolChunkPayload {
  id?: string;
  args?: string;
  delta?: boolean;
}
interface ToolResultPayload {
  id?: string;
  ok?: boolean;
  text?: string;
}
interface BusyPayload {
  busy?: boolean;
}

export async function registerAgentEventBridge(): Promise<void> {
  addTauriUnlistenFn(
    await listen<UserPayload>("vibe:agent:user", (e) => {
      emitEvent({ kind: "user", text: e.payload.text ?? "", index: e.payload.index });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:assistant-start", () => {
      emitEvent({ kind: "assistant-start" });
    }),
  );
  addTauriUnlistenFn(
    await listen<TextPayload>("vibe:agent:assistant-chunk", (e) => {
      emitEvent({ kind: "assistant-chunk", text: e.payload.text ?? "" });
    }),
  );
  addTauriUnlistenFn(
    await listen<ReasoningPayload>("vibe:agent:reasoning-start", (e) => {
      emitEvent({ kind: "reasoning-start", name: e.payload?.name });
    }),
  );
  addTauriUnlistenFn(
    await listen<ReasoningPayload>("vibe:agent:reasoning-chunk", (e) => {
      emitEvent({ kind: "reasoning-chunk", text: e.payload?.text ?? "", name: e.payload?.name });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:reasoning-end", () => {
      emitEvent({ kind: "reasoning-end" });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:assistant-end", () => {
      emitEvent({ kind: "assistant-end" });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolCallPayload>("vibe:agent:tool-call", (e) => {
      emitEvent({
        kind: "tool-call",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
        args: e.payload.args ?? {},
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolChunkPayload>("vibe:agent:tool-chunk", (e) => {
      emitEvent({
        kind: "tool-chunk",
        id: e.payload.id ?? "",
        args: e.payload.args ?? "",
        delta: e.payload.delta === true,
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolResultPayload>("vibe:agent:tool-result", (e) => {
      emitEvent({
        kind: "tool-result",
        id: e.payload.id ?? "",
        ok: e.payload.ok ?? false,
        text: e.payload.text ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolCallPayload>("vibe:agent:tool-denied", (e) => {
      emitEvent({
        kind: "tool-denied",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<BusyPayload>("vibe:agent:busy", (e) => {
      emitBusy(e.payload.busy ?? false);
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:done", () => {
      emitEvent({ kind: "done" });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:stopped", () => {
      emitEvent({ kind: "stopped" });
    }),
  );
  addTauriUnlistenFn(
    await listen<TextPayload>("vibe:agent:error", (e) => {
      emitEvent({ kind: "error", text: e.payload.text ?? "" });
    }),
  );
}
