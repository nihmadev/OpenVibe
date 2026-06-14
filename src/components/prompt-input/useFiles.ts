import { useState, useCallback } from "react";
import type { Attachment } from "./types.js";
import { newAttachId, fileToDataUrl, IMAGE_RE, basename } from "./utils.js";

export function useFiles() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const addAttachment = useCallback((a: Attachment) => {
    setAttachments((prev) => {
      if (a.path && prev.some((p) => p.path === a.path)) return prev;
      return [...prev, a];
    });
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      for (const file of list) {
        const isImage = file.type.startsWith("image/") || IMAGE_RE.test(file.name);
        if (isImage) {
          try {
            const dataUrl = await fileToDataUrl(file);
            addAttachment({
              id: newAttachId(),
              kind: "image",
              name: file.name,
              dataUrl,
            });
          } catch {
            // skip
          }
        } else {
          const anyFile = file as File & { path?: string };
          addAttachment({
            id: newAttachId(),
            kind: "file",
            path: anyFile.path,
            name: file.name,
          });
        }
      }
    },
    [addAttachment],
  );

  const readImageAttachment = useCallback(
    async (path: string) => {
      addAttachment({
        id: newAttachId(),
        kind: "file",
        path,
        name: basename(path),
      });
    },
    [addAttachment],
  );

  return {
    attachments,
    setAttachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    handleFiles,
    readImageAttachment,
  };
}
