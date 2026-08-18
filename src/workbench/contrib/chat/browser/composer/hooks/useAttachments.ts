import { useCallback, useMemo, useState } from "react";
import type { Attachment } from "../../../common/chat";
import { fileToAttachment } from "../composerUtils";

/** Attachment list state: adding dropped/pasted files, preview dialog, removal. */
export function useAttachments() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const addAttachment = useCallback((a: Attachment) => {
    setAttachments((prev) => (a.path && prev.some((p) => p.path === a.path) ? prev : [...prev, a]));
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        const att = await fileToAttachment(file);
        if (att) addAttachment(att);
      }
    },
    [addAttachment],
  );

  const imageAttachments = useMemo(
    () => attachments.filter((a): a is Attachment & { kind: "image" } => a.kind === "image"),
    [attachments],
  );

  return {
    attachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    handleFiles,
    imageAttachments,
    previewAttachment,
    setPreviewAttachment,
  };
}
