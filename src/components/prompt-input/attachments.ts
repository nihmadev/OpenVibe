import { IMAGE_RE, fileToDataUrl } from "./utils.js";
import type { Attachment } from "./types.js";

const ACCEPTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
]);

const TEXT_MIMES = new Set([
  "application/json",
  "application/ld+json",
  "application/toml",
  "application/x-toml",
  "application/x-yaml",
  "application/xml",
  "application/yaml",
]);

const SAMPLE = 4096;

function kind(type: string) {
  return type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function ext(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "";
  return name.slice(idx + 1).toLowerCase();
}

function textMime(type: string) {
  if (!type) return false;
  if (type.startsWith("text/")) return true;
  if (TEXT_MIMES.has(type)) return true;
  if (type.endsWith("+json")) return true;
  return type.endsWith("+xml");
}

function textBytes(bytes: Uint8Array) {
  if (bytes.length === 0) return true;
  let count = 0;
  for (const byte of bytes) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) count += 1;
  }
  return count / bytes.length <= 0.3;
}

export async function attachmentMime(file: File) {
  const type = kind(file.type);
  if (ACCEPTED_IMAGE_TYPES.has(type)) return type;
  if (type === "application/pdf") return type;

  const suffix = ext(file.name);
  const fallback =
    suffix === "png"
      ? "image/png"
      : suffix === "jpg" || suffix === "jpeg"
        ? "image/jpeg"
        : suffix === "gif"
          ? "image/gif"
          : suffix === "webp"
            ? "image/webp"
            : suffix === "bmp"
              ? "image/bmp"
              : suffix === "svg"
                ? "image/svg+xml"
                : suffix === "pdf"
                  ? "application/pdf"
                  : undefined;
  if ((!type || type === "application/octet-stream") && fallback) return fallback;

  if (textMime(type)) return "text/plain";
  const bytes = new Uint8Array(await file.slice(0, SAMPLE).arrayBuffer());
  if (!textBytes(bytes)) return;
  return "text/plain";
}

let attachIdSeq = 0;
export const newAttachmentId = (): string => `a${++attachIdSeq}-${Date.now().toString(36)}`;

export async function fileToAttachment(file: File): Promise<Attachment | null> {
  const mime = await attachmentMime(file);
  if (!mime) return null;

  if (ACCEPTED_IMAGE_TYPES.has(mime)) {
    const dataUrl = await fileToDataUrl(file);
    return {
      id: newAttachmentId(),
      kind: "image",
      name: file.name,
      dataUrl,
    };
  }

  const anyFile = file as File & { path?: string };
  return {
    id: newAttachmentId(),
    kind: "file",
    path: anyFile.path,
    name: file.name,
  };
}
