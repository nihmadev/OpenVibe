import { useCallback } from "react";
import type { SendPayload, Attachment } from "../components/prompt-input/PromptInput.js";
import type { ContentPart } from "../types.js";
import { localId } from "../utils.js";

interface UseAppHandlersProps {
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  pendingAttachments: React.MutableRefObject<any[] | undefined>;
}

export function useAppHandlers({
  setItems,
  pendingAttachments,
}: UseAppHandlersProps) {

  const handleSubmit = useCallback(
    (payload: SendPayload) => {
      const { parts, display, attachments } = payload;
      if (attachments.length > 0) {
        pendingAttachments.current = attachments.map((a: Attachment) => ({
          id: a.id,
          kind: a.kind,
          name: a.name,
          path: a.path,
          dataUrl: a.dataUrl,
        }));
      }
      if (parts.length === 1 && parts[0]!.type === "text") {
        window.vibe.send(parts[0]!.text).then((res) => {
          if (!res.ok && res.error) {
            setItems((p) => [...p, { id: localId(), kind: "error", text: res.error! }]);
          }
        });
        return;
      }
      window.vibe.sendParts(parts as ContentPart[], display).then((res) => {
        if (!res.ok && res.error) {
          setItems((p) => [...p, { id: localId(), kind: "error", text: res.error! }]);
        }
      });
    },
    [setItems, pendingAttachments],
  );

  return { handleSubmit };
}
