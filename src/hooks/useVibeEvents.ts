import { useState, useEffect, useRef, useCallback } from "react";
import type { VibeEvent } from "../types.js";
import { localId, playAudio } from "../utils.js";
import type { HistoryItem } from "../components/AgentChat/AgentChat.js";

function useRafBatching() {
  const pendingRef = useRef<(() => void)[]>([]);
  const rafId = useRef<number>(0);

  const schedule = useCallback((fn: () => void) => {
    pendingRef.current.push(fn);
    if (!rafId.current) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        const batch = pendingRef.current;
        pendingRef.current = [];
        for (const f of batch) f();
      });
    }
  }, []);

  const flush = useCallback(() => {
    if (rafId.current) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    const batch = pendingRef.current;
    pendingRef.current = [];
    for (const f of batch) f();
  }, []);

  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    },
    [],
  );

  return { schedule, flush };
}

export function useVibeEvents(onActivity: () => void) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [streamingNow, setStreamingNow] = useState<string | null>(null);
  const streamingId = useRef<string | null>(null);
  const pendingAttachments = useRef<HistoryItem["attachments"]>(undefined);
  const { schedule, flush } = useRafBatching();

  useEffect(() => {
    const offEvent = window.vibe.onEvent((e: VibeEvent) => {
      const sid = streamingId.current;

      switch (e.kind) {
        case "user": {
          const atts = pendingAttachments.current;
          pendingAttachments.current = undefined;
          flush();
          setItems((prev) => [
            ...(prev ?? []),
            {
              id: localId(),
              kind: "user",
              text: e.text,
              msgIndex: (e as any).index,
              attachments: atts?.length ? atts : undefined,
            },
          ]);
          break;
        }
        case "assistant-start": {
          const id = localId();
          streamingId.current = id;
          flush();
          setStreamingNow(id);
          setItems((prev) => [...(prev ?? []), { id, kind: "assistant", text: "" }]);
          break;
        }
        case "assistant-chunk": {
          if (!sid) break;
          schedule(() => {
            setItems((prev) => {
              if (!prev) return prev;
              const last = prev[prev.length - 1];
              if (last?.id === sid) {
                const next = [...prev];
                next[next.length - 1] = { ...last, text: last.text + e.text };
                return next;
              }
              return prev.map((it) => (it.id === sid ? { ...it, text: it.text + e.text } : it));
            });
          });
          break;
        }
        case "reasoning-start": {
          if (!sid) break;
          schedule(() => {
            setItems((prev) => {
              if (!prev) return prev;
              return prev.map((it) =>
                it.id === sid && it.kind === "assistant" ? { ...it, reasoningName: e.name ?? it.reasoningName } : it,
              );
            });
          });
          break;
        }
        case "reasoning-chunk": {
          if (!sid) break;
          schedule(() => {
            setItems((prev) => {
              if (!prev) return prev;
              return prev.map((it) =>
                it.id === sid && it.kind === "assistant"
                  ? {
                      ...it,
                      reasoning: (it.reasoning ?? "") + e.text,
                      reasoningName: e.name ?? it.reasoningName,
                    }
                  : it,
              );
            });
          });
          break;
        }
        case "reasoning-end": {
          if (!sid) break;
          flush();
          setItems((prev) => {
            if (!prev) return prev;
            return prev.map((it) => (it.id === sid && it.kind === "assistant" ? { ...it, reasoningDone: true } : it));
          });
          break;
        }
        case "assistant-end": {
          streamingId.current = null;
          flush();
          setStreamingNow(null);
          if (!sid) break;
          const textNoiseRe = /^(done|done\.|finished|finished\.|completed|completed\.)$/i;
          setItems((prev) => {
            if (!prev) return prev;
            return prev
              .map((it) => {
                if (it.id === sid && it.kind === "assistant") {
                  const trimmed = it.text.trim();
                  const next = { ...it, reasoningDone: it.reasoning ? true : it.reasoningDone };
                  if (textNoiseRe.test(trimmed)) return { ...next, text: "" };
                  return next;
                }
                return it;
              })
              .filter((it) => it.id !== sid || it.text.length > 0 || !!it.reasoning);
          });
          break;
        }
        case "tool-call":
          flush();
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
        case "tool-chunk":
          schedule(() => {
            setItems((prev) => {
              if (!prev) return prev;
              return prev.map((it) => {
                if (it.id !== e.id || it.kind !== "tool") return it;
                let parsed = it.toolArgs;
                try {
                  parsed = JSON.parse(e.args);
                } catch {
                  /* invalid JSON */
                }
                return { ...it, toolArgs: parsed, toolStream: e.args };
              });
            });
          });
          break;
        case "tool-result":
          flush();
          setItems((prev) => {
            if (!prev) return prev;
            // Failed read/search/list calls are still sent to the model as a
            // tool message (with a diagnostic hint), but are not useful chat
            // content for the user. Remove the pending visualization entirely.
            if (!e.ok) return prev.filter((it) => it.id !== e.id);
            return prev.map((it) => (it.id === e.id ? { ...it, text: e.text, ok: true } : it));
          });
          break;
        case "tool-denied":
          flush();
          setItems((prev) => {
            if (!prev) return prev;
            return prev.filter((it) => it.id !== e.id);
          });
          break;
        case "info": {
          flush();
          setItems((prev) => [...(prev ?? []), { id: localId(), kind: "info", text: e.text }]);
          break;
        }
        case "stopped": {
          setBusy(false);
          flush();
          setStreamingNow(null);
          streamingId.current = null;
          playAudio("stoped.mp3");
          setItems((prev) => {
            if (!prev) return prev;
            return [
              ...prev.map((it) =>
                it.id === sid && it.kind === "assistant" && it.reasoning ? { ...it, reasoningDone: true } : it,
              ),
              { id: localId(), kind: "stopped", text: "" },
            ];
          });
          break;
        }
        case "done":
          playAudio("succes.mp3");
          break;
        case "error":
          setBusy(false);
          flush();
          setStreamingNow(null);
          streamingId.current = null;
          setItems((prev) => {
            if (!prev) return prev;
            return [
              ...prev.map((it) =>
                it.id === sid && it.kind === "assistant" && it.reasoning ? { ...it, reasoningDone: true } : it,
              ),
              { id: localId(), kind: "error", text: e.text },
            ];
          });
          break;
      }

      if (e.kind === "user" || e.kind === "assistant-end" || e.kind === "tool-result") {
        onActivity();
      }
    });

    const offBusy = window.vibe.onBusy(setBusy);

    return () => {
      offEvent();
      offBusy();
    };
  }, [onActivity, schedule, flush]);

  return {
    items,
    setItems,
    busy,
    setBusy,
    streamingNow,
    setStreamingNow,
    pendingAttachments,
  };
}
