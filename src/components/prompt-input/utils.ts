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

export function basename(path: string): string {
  const m = /[\\/]([^\\/]+)$/.exec(path);
  return m?.[1] ?? path;
}

export const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
