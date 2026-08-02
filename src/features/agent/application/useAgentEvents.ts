import { useCallback, useEffect, useRef, useState } from "react";
import { playAudio } from "@/shared/lib/audio";
import { localId } from "@/shared/lib/localId";
import { onAgentBusy, onAgentEvent } from "../infrastructure/agentEvents";
import type { AgentEvent } from "../model/agentEvents";
import type { FileMentionView, HistoryItem } from "../model/history";

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

export function useAgentEvents(onActivity: () => void) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [streamingNow, setStreamingNow] = useState<string | null>(null);
  const streamingId = useRef<string | null>(null);
  /** Accumulated tool-args streams by call id (deltas merged outside React state). */
  const toolStreamAcc = useRef<Map<string, string>>(new Map());
  const pendingAttachments = useRef<HistoryItem["attachments"]>(undefined);
  const pendingMentions = useRef<FileMentionView[] | undefined>(undefined);
  const { schedule, flush } = useRafBatching();

  useEffect(() => {
    const offEvent = onAgentEvent((e: AgentEvent) => {
      const sid = streamingId.current;

      switch (e.kind) {
        case "user": {
          const now = Date.now();
          const atts = pendingAttachments.current;
          pendingAttachments.current = undefined;
          const mnts = pendingMentions.current;
          pendingMentions.current = undefined;
          flush();
          setItems((prev) => [
            ...(prev ?? []),
            {
              id: localId(),
              kind: "user",
              text: e.text,
              msgIndex: e.index,
              attachments: atts?.length ? atts : undefined,
              mentions: mnts?.length ? mnts : undefined,
              startedAt: now,
              completedAt: now,
            },
          ]);
          break;
        }
        case "assistant-start": {
          const id = localId();
          const startedAt = Date.now();
          streamingId.current = id;
          flush();
          setStreamingNow(id);
          setItems((prev) => [...(prev ?? []), { id, kind: "assistant", text: "", startedAt }]);
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
          const completedAt = Date.now();
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
                  const next = { ...it, reasoningDone: it.reasoning ? true : it.reasoningDone, completedAt };
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
          toolStreamAcc.current.delete(e.id);
          flush();
          setItems((prev) => [
            ...(prev ?? []),
            {
              id: e.id,
              kind: "tool",
              text: "",
              toolName: e.name,
              toolArgs: e.args,
              startedAt: Date.now(),
            },
          ]);
          break;
        case "tool-chunk": {
          // Delta events carry only the new fragment; accumulate outside of
          // React state so multiple deltas per frame cost one string concat
          // each, then commit (and JSON.parse) at most once per rAF.
          const acc = toolStreamAcc.current;
          const full = e.delta ? (acc.get(e.id) ?? "") + e.args : e.args;
          acc.set(e.id, full);
          schedule(() => {
            const latest = toolStreamAcc.current.get(e.id);
            if (latest === undefined) return;
            setItems((prev) => {
              if (!prev) return prev;
              return prev.map((it) => {
                if (it.id !== e.id || it.kind !== "tool") return it;
                if (it.toolStream === latest) return it;
                let parsed = it.toolArgs;
                try {
                  parsed = JSON.parse(latest);
                } catch {
                  /* invalid/partial JSON — keep previous parsed args */
                }
                return { ...it, toolArgs: parsed, toolStream: latest };
              });
            });
          });
          break;
        }
        case "tool-result":
          toolStreamAcc.current.delete(e.id);
          flush();
          {
            const completedAt = Date.now();
            setItems((prev) => {
              if (!prev) return prev;
              // Failed read/search/list calls are still sent to the model as a
              // tool message (with a diagnostic hint), but are not useful chat
              // content for the user. Remove the pending visualization entirely.
              if (!e.ok) return prev.filter((it) => it.id !== e.id);
              return prev.map((it) => (it.id === e.id ? { ...it, text: e.text, ok: true, completedAt } : it));
            });
          }
          break;
        case "tool-denied":
          flush();
          setItems((prev) => {
            if (!prev) return prev;
            return prev.filter((it) => it.id !== e.id);
          });
          break;
        case "info": {
          const now = Date.now();
          flush();
          setItems((prev) => [
            ...(prev ?? []),
            { id: localId(), kind: "info", text: e.text, startedAt: now, completedAt: now },
          ]);
          break;
        }
        case "stopped": {
          const now = Date.now();
          setBusy(false);
          toolStreamAcc.current.clear();
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
              { id: localId(), kind: "stopped", text: "", startedAt: now, completedAt: now },
            ];
          });
          break;
        }
        case "done":
          playAudio("succes.mp3");
          break;
        case "error":
          {
            const now = Date.now();
            setBusy(false);
            toolStreamAcc.current.clear();
            flush();
            setStreamingNow(null);
            streamingId.current = null;
            setItems((prev) => {
              if (!prev) return prev;
              return [
                ...prev.map((it) =>
                  it.id === sid && it.kind === "assistant" && it.reasoning ? { ...it, reasoningDone: true } : it,
                ),
                { id: localId(), kind: "error", text: e.text, startedAt: now, completedAt: now },
              ];
            });
          }
          break;
      }

      if (e.kind === "user" || e.kind === "assistant-end" || e.kind === "tool-result") {
        onActivity();
      }
    });

    const offBusy = onAgentBusy(setBusy);

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
    pendingMentions,
  };
}
