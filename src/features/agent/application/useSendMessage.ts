import { useCallback } from "react";
import { agentGateway } from "@/features/agent/infrastructure/agentGateway";
import { localId } from "@/shared/lib/localId";
import type { AttachmentView, FileMentionView, HistoryItem } from "../model/history";
import type { SendPayload } from "../model/sendPayload";

interface UseSendMessageProps {
  setItems: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  pendingAttachments: React.MutableRefObject<AttachmentView[] | undefined>;
  pendingMentions: React.MutableRefObject<FileMentionView[] | undefined>;
}

export function useSendMessage({ setItems, pendingAttachments, pendingMentions }: UseSendMessageProps) {
  const handleSubmit = useCallback(
    (payload: SendPayload) => {
      const { parts, display, attachments, mentions } = payload;
      if (attachments.length > 0) {
        pendingAttachments.current = attachments.map((a) => ({
          id: a.id,
          kind: a.kind,
          name: a.name,
          path: a.path,
          dataUrl: a.dataUrl,
        }));
      }
      if (mentions && mentions.length > 0) {
        pendingMentions.current = mentions;
      }
      const pushError = (error: string) => {
        setItems((p) => [...p, { id: localId(), kind: "error", text: error }]);
      };
      if (parts.length === 1 && parts[0]?.type === "text") {
        agentGateway.send(parts[0].text).then((res) => {
          if (!res.ok && res.error) pushError(res.error);
        });
        return;
      }
      agentGateway.sendParts(parts, display).then((res) => {
        if (!res.ok && res.error) pushError(res.error);
      });
    },
    [setItems, pendingAttachments, pendingMentions],
  );

  const handleStop = useCallback(() => {
    void agentGateway.stop();
  }, []);

  return { handleSubmit, handleStop };
}
