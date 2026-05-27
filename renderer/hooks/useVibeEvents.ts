import { useState, useEffect, useRef } from "react";
import type { VibeEvent, ConfirmPayload } from "../types.js";
import { localId, playAudio } from "../utils.js";
import type { HistoryItem } from "../components/chat-history/ChatHistory.js";

export function useVibeEvents(onActivity: () => void) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ConfirmPayload | null>(null);
  const [streamingNow, setStreamingNow] = useState<string | null>(null);
  const streamingId = useRef<string | null>(null);
  const pendingAttachments = useRef<HistoryItem["attachments"]>(undefined);

  useEffect(() => {
    const offEvent = window.vibe.onEvent((e: VibeEvent) => {
      // Capture streamingId ref value BEFORE any side effects for this event.
      // React defers setItems callbacks, so reading the ref inside them would
      // see stale values if a later event already mutated it.
      const sid = streamingId.current;

      switch (e.kind) {
        case "user": {
          const atts = pendingAttachments.current;
          pendingAttachments.current = undefined;
          setItems((prev) => [
            ...(prev ?? []),
            {
              id: localId(),
              kind: "user",
              text: e.text,
              attachments: atts?.length ? atts : undefined,
            },
          ]);
          break;
        }
        case "assistant-start": {
          const id = localId();
          streamingId.current = id;
          setStreamingNow(id);
          setItems((prev) => [
            ...(prev ?? []),
            { id, kind: "assistant", text: "" },
          ]);
          break;
        }
        case "assistant-chunk": {
          if (!sid) break;
          setItems((prev) => {
            if (!prev) return prev;
            const last = prev[prev.length - 1];
            if (last?.id === sid) {
              const next = [...prev];
              next[next.length - 1] = { ...last, text: last.text + e.text };
              return next;
            }
            return prev.map((it) =>
              it.id === sid ? { ...it, text: it.text + e.text } : it,
            );
          });
          break;
        }
        case "reasoning-chunk": {
          if (!sid) break;
          setItems((prev) => {
            if (!prev) return prev;
            return prev.map((it) =>
              it.id === sid && it.kind === "assistant"
                ? { ...it, reasoning: (it.reasoning ?? "") + e.text }
                : it,
            );
          });
          break;
        }
        case "reasoning-end": {
          if (!sid) break;
          setItems((prev) => {
            if (!prev) return prev;
            return prev.map((it) =>
              it.id === sid && it.kind === "assistant"
                ? { ...it, reasoningDone: true }
                : it,
            );
          });
          break;
        }
        case "assistant-end": {
          streamingId.current = null;
          setStreamingNow(null);
          if (!sid) break;
          const textNoiseRe = /^(done|done\.|finished|finished\.|completed|completed\.)$/i;
          setItems((prev) => {
            if (!prev) return prev;
            return prev
              .map((it) => {
                if (it.id === sid && it.kind === "assistant") {
                  const trimmed = it.text.trim();
                  if (textNoiseRe.test(trimmed)) return { ...it, text: "" };
                }
                return it;
              })
              .filter((it) => it.id !== sid || it.text.length > 0 || !!it.reasoning);
          });
          break;
        }
        case "tool-call":
          setItems((prev) => [
            ...(prev ?? []),
            {
              id: e.id,
              kind: "tool",
              text: "",
              toolName: e.name,
              toolArgs: e.args,
            },
          ]);
          break;
        case "tool-result":
          setItems((prev) => {
            if (!prev) return prev;
            return prev.map((it) =>
              it.id === e.id ? { ...it, text: e.text, ok: e.ok } : it,
            );
          });
          break;
        case "tool-denied":
          setItems((prev) => {
            if (!prev) return prev;
            return prev.map((it) =>
              it.id === e.id ? { ...it, text: "denied", ok: false } : it,
            );
          });
          break;
        case "info": {
          setItems((prev) => [
            ...(prev ?? []),
            { id: localId(), kind: "info", text: e.text },
          ]);
          break;
        }
        case "stopped": {
          setBusy(false);
          setStreamingNow(null);
          streamingId.current = null;
          playAudio("stoped.mp3");
          setItems((prev) => [
            ...(prev ?? []),
            { id: localId(), kind: "stopped", text: "" },
          ]);
          break;
        }
        case "done":
          playAudio("succes.mp3");
          break;
        case "error":
          setBusy(false);
          setStreamingNow(null);
          streamingId.current = null;
          setItems((prev) => [
            ...(prev ?? []),
            { id: localId(), kind: "error", text: e.text },
          ]);
          break;
      }

      if (
        e.kind === "user" ||
        e.kind === "assistant-end" ||
        e.kind === "tool-result"
      ) {
        onActivity();
      }
    });

    const offBusy = window.vibe.onBusy(setBusy);
    const offConfirm = window.vibe.onConfirm(setPending);

    return () => {
      offEvent();
      offBusy();
      offConfirm();
    };
  }, [onActivity]);

  return {
    items,
    setItems,
    busy,
    setBusy,
    pending,
    setPending,
    streamingNow,
    setStreamingNow,
    pendingAttachments,
  };
}
