import { ICON_MAP, FOLDER_MAP, LANGUAGE_MAP } from "./maps.js";

export function getFileIcon(filename: string): string | null {
  // Check full filename first (for package.json etc)
  if (ICON_MAP[filename.toLowerCase()]) return ICON_MAP[filename.toLowerCase()];

  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return ICON_MAP[ext] ?? null;
}

export function getLanguage(filename: string): string {
  const lower = filename.toLowerCase();
  if (LANGUAGE_MAP[lower]) return LANGUAGE_MAP[lower];

  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  const ext = filename.slice(dot + 1).toLowerCase();
  return LANGUAGE_MAP[ext] ?? "plaintext";
}

export function getFolderIcon(name: string | undefined, open: boolean): string {
  if (!name) return open ? "folder-open.svg" : "folder.svg";

  const lowerName = name.toLowerCase();
  const icon = FOLDER_MAP[lowerName];
  if (icon) return open ? "folder-open.svg" : `${icon}.svg`;
  return open ? "folder-open.svg" : "folder.svg";
}
