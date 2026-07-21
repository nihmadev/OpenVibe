import { basename } from "../../utils/paths.js";
export { basename };

let attachIdSeq = 0;
export const newAttachId = (): string => `a${++attachIdSeq}-${Date.now().toString(36)}`;

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

import type { Attachment } from "./types.js";

export async function fileToAttachment(file: File): Promise<Attachment | null> {
  if (!IMAGE_RE.test(file.name) && !file.type.startsWith("image/")) return null;
  const dataUrl = await fileToDataUrl(file);
  return {
    id: newAttachId(),
    name: file.name,
    dataUrl,
    sizeBytes: file.size,
  };
}
