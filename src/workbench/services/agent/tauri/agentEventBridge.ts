// Bridges raw Tauri agent events into the typed AgentEvent stream.
import { listen } from "@tauri-apps/api/event";
import { addTauriUnlistenFn } from "@/platform/native/tauri/listenerRegistry";
import { emitBrowserEvent } from "@/workbench/contrib/browser/browser/browserEventService";
import type { BrowserEvent } from "@/workbench/contrib/browser/common/browser";
import { emitAgentBusy, emitAgentEvent } from "../browser/agentEventService";

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
interface UsagePayload {
  ttftMs?: number | null;
  tokensPerSec?: number;
  streamSecs?: number;
  promptTokens?: number;
  completionTokens?: number;
}

const STREAM_START_MARK = "vibe-agent-stream-start";
let firstChunkPending = false;
let lastBrowserSnapshotForwardedAt = 0;

function markFirstChunk(): void {
  if (!firstChunkPending) return;
  firstChunkPending = false;
  performance.mark("vibe-agent-first-event");
  performance.measure("vibe-agent:ttft-event", STREAM_START_MARK, "vibe-agent-first-event");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      performance.mark("vibe-agent-first-paint");
      performance.measure("vibe-agent:ttft-paint", STREAM_START_MARK, "vibe-agent-first-paint");
    });
  });
}

export async function registerAgentEventBridge(): Promise<void> {
  addTauriUnlistenFn(
    await listen<UserPayload>("vibe:agent:user", (e) => {
      emitAgentEvent({ kind: "user", text: e.payload.text ?? "", index: e.payload.index });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:assistant-start", () => {
      firstChunkPending = true;
      performance.mark(STREAM_START_MARK);
      emitAgentEvent({ kind: "assistant-start" });
    }),
  );
  addTauriUnlistenFn(
    await listen<TextPayload>("vibe:agent:assistant-chunk", (e) => {
      markFirstChunk();
      emitAgentEvent({ kind: "assistant-chunk", text: e.payload.text ?? "" });
    }),
  );
  addTauriUnlistenFn(
    await listen<ReasoningPayload>("vibe:agent:reasoning-start", (e) => {
      emitAgentEvent({ kind: "reasoning-start", name: e.payload?.name });
    }),
  );
  addTauriUnlistenFn(
    await listen<ReasoningPayload>("vibe:agent:reasoning-chunk", (e) => {
      markFirstChunk();
      emitAgentEvent({ kind: "reasoning-chunk", text: e.payload?.text ?? "", name: e.payload?.name });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:reasoning-end", () => {
      emitAgentEvent({ kind: "reasoning-end" });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:assistant-end", () => {
      emitAgentEvent({ kind: "assistant-end" });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolCallPayload>("vibe:agent:tool-call", (e) => {
      emitAgentEvent({
        kind: "tool-call",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
        args: e.payload.args ?? {},
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolChunkPayload>("vibe:agent:tool-chunk", (e) => {
      emitAgentEvent({
        kind: "tool-chunk",
        id: e.payload.id ?? "",
        args: e.payload.args ?? "",
        delta: e.payload.delta === true,
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolResultPayload>("vibe:agent:tool-result", (e) => {
      emitAgentEvent({
        kind: "tool-result",
        id: e.payload.id ?? "",
        ok: e.payload.ok ?? false,
        text: e.payload.text ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<ToolCallPayload>("vibe:agent:tool-denied", (e) => {
      emitAgentEvent({
        kind: "tool-denied",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<UsagePayload>("vibe:agent:stream-metrics", (e) => {
      window.dispatchEvent(new CustomEvent("vibe:agent:stream-metrics", { detail: e.payload }));
    }),
  );
  addTauriUnlistenFn(
    await listen<UsagePayload>("vibe:agent:usage", (e) => {
      window.dispatchEvent(new CustomEvent("vibe:agent:stream-metrics", { detail: e.payload }));
    }),
  );
  addTauriUnlistenFn(
    await listen<BusyPayload>("vibe:agent:busy", (e) => {
      emitAgentBusy(e.payload.busy ?? false);
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:done", () => {
      emitAgentEvent({ kind: "done" });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:stopped", () => {
      emitAgentEvent({ kind: "stopped" });
    }),
  );
  addTauriUnlistenFn(
    await listen<TextPayload>("vibe:agent:error", (e) => {
      emitAgentEvent({ kind: "error", text: e.payload.text ?? "" });
    }),
  );
  await registerBrowserEvents();
}

const BROWSER_EVENT_NAMES = [
  "browser:session-started",
  "browser:page-changed",
  "browser:loading",
  "browser:snapshot",
  "browser:pointer-move",
  "browser:pointer-down",
  "browser:pointer-up",
  "browser:action-started",
  "browser:action-completed",
  "browser:manual-control",
  "browser:error",
  "browser:session-closed",
] as const;

async function registerBrowserEvents(): Promise<void> {
  for (const type of BROWSER_EVENT_NAMES) {
    addTauriUnlistenFn(
      await listen<Record<string, unknown>>(type, (event) => {
        const browserEvent = { type, ...event.payload } as BrowserEvent;
        emitBrowserEvent(browserEvent);
        // The live screencast can run at display refresh rate. Keep the event
        // connected to the agent bridge, but never duplicate the large base64
        // frame through agent subscribers that only need semantic metadata.
        const agentBrowserEvent =
          browserEvent.type === "browser:snapshot" ? { ...browserEvent, image: undefined } : browserEvent;
        if (browserEvent.type !== "browser:snapshot" || performance.now() - lastBrowserSnapshotForwardedAt >= 250) {
          if (browserEvent.type === "browser:snapshot") lastBrowserSnapshotForwardedAt = performance.now();
          emitAgentEvent({ kind: "browser", event: agentBrowserEvent });
        }
      }),
    );
  }
}
