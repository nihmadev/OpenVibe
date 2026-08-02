// Regenerate: truncate the history back to the preceding user message and
// resubmit it through the send pipeline.
import { useCallback } from "react";
import type { HistoryItem } from "../model/history";
import type { SendPayload } from "../model/sendPayload";

export function useRegenerate(
  items: HistoryItem[],
  setItems: React.Dispatch<React.SetStateAction<HistoryItem[]>>,
  submit: (payload: SendPayload) => void,
) {
  return useCallback(
    (id: string) => {
      const idx = items.findIndex((it) => it.id === id);
      if (idx < 0) return;
      let userIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (items[i]?.kind === "user") {
          userIdx = i;
          break;
        }
      }
      if (userIdx < 0) return;
      const userMsg = items[userIdx]!;
      setItems((p) => p.slice(0, userIdx));
      submit({
        parts: [{ type: "text", text: userMsg.text }],
        display: userMsg.text,
        mentions: userMsg.mentions,
        attachments: userMsg.attachments
          ? userMsg.attachments.map((a) => ({
              id: a.id,
              kind: a.kind,
              name: a.name,
              path: a.path,
              dataUrl: a.dataUrl,
            }))
          : [],
      });
    },
    [items, setItems, submit],
  );
}
