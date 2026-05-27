import { loader } from "@monaco-editor/react";

// Preload only the most common file/folder icons to reduce HTTP flood on startup
const COMMON_FILE_ICONS = [
  "js.svg", "ts.svg", "tsx.svg", "react-ts.svg", "json.svg",
  "md.svg", "css.svg", "html.svg", "python.svg", "go.svg",
  "rs.svg", "document.svg", "npm.svg", "git.svg", "gear.svg",
];

const COMMON_FOLDER_ICONS = [
  "folder-src.svg", "folder-node-modules.svg", "folder-app.svg",
  "folder-assets.svg", "folder-config.svg", "folder-open.svg",
  "folder.svg", "folder-github.svg", "folder-documents.svg",
];

function prefetchImage(url: string): void {
  const img = new Image();
  img.src = url;
}

export function preloadCommonIcons(): void {
  for (const icon of COMMON_FILE_ICONS) {
    prefetchImage(`icons/symbols/files/${icon}`);
  }
  for (const icon of COMMON_FOLDER_ICONS) {
    prefetchImage(`icons/symbols/folders/${icon}`);
  }
}

export function preloadAll(): void {
  preloadCommonIcons();
  loader.init().catch(() => {});
}
