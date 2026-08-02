import { loader } from "@monaco-editor/react";

/** Frequently used file icon vector assets cached during startup. */
const COMMON_FILE_ICONS = [
  "js.svg",
  "ts.svg",
  "tsx.svg",
  "react-ts.svg",
  "json.svg",
  "md.svg",
  "css.svg",
  "html.svg",
  "python.svg",
  "go.svg",
  "rs.svg",
  "document.svg",
  "npm.svg",
  "git.svg",
  "gear.svg",
];

/** Frequently used directory icon vector assets cached during startup. */
const COMMON_FOLDER_ICONS = [
  "folder-src.svg",
  "folder-node-modules.svg",
  "folder-app.svg",
  "folder-assets.svg",
  "folder-config.svg",
  "folder-open.svg",
  "folder.svg",
  "folder-github.svg",
  "folder-documents.svg",
];

/** Pre-downloads a remote static image resource into the browser cache. */
function prefetchImage(url: string): void {
  const img = new Image();
  img.src = url;
}

/** Preloads primary workspace file and directory icons to minimize UI paint latency. */
export function preloadCommonIcons(): void {
  for (const icon of COMMON_FILE_ICONS) {
    prefetchImage(`icons/symbols/files/${icon}`);
  }
  for (const icon of COMMON_FOLDER_ICONS) {
    prefetchImage(`icons/symbols/folders/${icon}`);
  }
}

/** Pre-initializes critical asset bundles including Monaco Editor workers and common icons. */
export function preloadAll(): void {
  preloadCommonIcons();
  loader.init().catch(() => {});
}
