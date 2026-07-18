import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  activeChatId,
  currentConfig,
  setCurrentConfig,
  cleanupTauriListeners,
  addTauriUnlistenFn,
  emitEvent,
  emitBusy,
  addBeforeUnloadCleanup,
} from "./state.js";

export async function initVibeBridge() {
  // Load config from Rust
  const cfg = await invoke<any>("read_config").catch(() => null);
  if (!cfg) return;

  setCurrentConfig({
    model: cfg.model ?? "",
    baseUrl: cfg.baseUrl ?? "",
    cwd: cfg.cwd ?? "",
    autoApprove: cfg.autoApprove ?? false,
    apiKey: cfg.apiKey ?? "",
    apiUrl: cfg.apiUrl,
    providerId: cfg.providerId,
  });

  // Create Rust agent
  await invoke("agent_new", { cwd: currentConfig!.cwd }).catch(() => {});

  // ---- Listen for Rust agent events and translate to VibeEvent ----
  await cleanupTauriListeners();

  addTauriUnlistenFn(
    await listen<any>("vibe:agent:user", (e) => {
      emitEvent({ kind: "user", text: e.payload.text ?? "", index: e.payload.index });
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:send-complete", () => {
      if (activeChatId) {
        invoke("chats_list")
          .then((list: any) => {
            const current = (list as any[]).find((c: any) => c.id === activeChatId);
            if (current && current.title === "New chat") {
              invoke<string>("agent_summarize").then((title) => {
                if (title && title !== "New chat") {
                  invoke("chats_rename", { id: activeChatId, title }).catch(() => {});
                }
              });
            }
          })
          .catch(() => {});
      }
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:assistant-start", () => {
      emitEvent({ kind: "assistant-start" });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:assistant-chunk", (e) => {
      emitEvent({ kind: "assistant-chunk", text: e.payload.text ?? "" });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:reasoning-start", (e) => {
      emitEvent({ kind: "reasoning-start", name: e.payload?.name });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:reasoning-chunk", (e) => {
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
    await listen<any>("vibe:agent:tool-call", (e) => {
      emitEvent({
        kind: "tool-call",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
        args: e.payload.args ?? {},
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:tool-chunk", (e) => {
      emitEvent({
        kind: "tool-chunk",
        id: e.payload.id ?? "",
        args: e.payload.args ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:tool-result", (e) => {
      emitEvent({
        kind: "tool-result",
        id: e.payload.id ?? "",
        ok: e.payload.ok ?? false,
        text: e.payload.text ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:tool-denied", (e) => {
      emitEvent({
        kind: "tool-denied",
        id: e.payload.id ?? "",
        name: e.payload.name ?? "",
      });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:busy", (e) => {
      emitBusy(e.payload.busy ?? false);
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:done", async () => {
      emitEvent({ kind: "done" });
      if (activeChatId) {
        try {
          const msgs = await invoke("agent_get_messages");
          await invoke("chats_save", { id: activeChatId, messages: msgs });
        } catch {
          /* ignore */
        }
      }
    }),
  );
  addTauriUnlistenFn(
    await listen("vibe:agent:stopped", () => {
      emitEvent({ kind: "stopped" });
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:agent:error", (e) => {
      emitEvent({ kind: "error", text: e.payload.text ?? "" });
    }),
  );

  // File system changes
  addTauriUnlistenFn(
    await listen("vibe:fs:changed", () => {
      window.dispatchEvent(new CustomEvent("vibe:fs:changed"));
    }),
  );

  // Chat updates
  addTauriUnlistenFn(
    await listen("vibe:chats:updated", () => {
      window.dispatchEvent(new CustomEvent("vibe:chats:updated"));
    }),
  );

  // Terminal events
  addTauriUnlistenFn(
    await listen<any>("vibe:term:data", (e) => {
      window.dispatchEvent(new CustomEvent("vibe:term:data", { detail: e.payload }));
    }),
  );
  addTauriUnlistenFn(
    await listen<any>("vibe:term:exit", (e) => {
      window.dispatchEvent(new CustomEvent("vibe:term:exit", { detail: e.payload }));
    }),
  );

  addBeforeUnloadCleanup();

  // Restore last active chat after restart / page reload
  try {
    const lastChatId = localStorage.getItem("openvibe:activeChatId");
    if (lastChatId) {
      const record = await invoke<any>("chats_open", { id: lastChatId });
      if (record && Array.isArray(record.messages)) {
        setCurrentConfig({
          ...currentConfig!,
        });
        // We set activeChatId in state
        const { setActiveChatId } = await import("./state.js");
        setActiveChatId(lastChatId);
        await invoke("agent_set_messages", { messages: record.messages }).catch(() => {});
        window.dispatchEvent(new CustomEvent("vibe:chat:restored", { detail: record }));
      }
    }
  } catch {
    localStorage.removeItem("openvibe:activeChatId");
  }
}
