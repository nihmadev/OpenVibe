/**
 * Guards against the webview accidentally navigating away from the app.
 *
 * The UI is a single-page app served from localhost in dev (and the bundled
 * assets in release). There is no client-side router, so ANY top-level
 * navigation replaces the whole app with a blank document — the user sees a
 * white flash and the SPA "reloads". This is not Vite HMR; it is the browser
 * following a link or a dropped file.
 *
 * Two everyday actions can trigger it:
 *   1. Clicking an <a href> rendered in agent markdown (external links).
 *   2. Dropping a file anywhere outside an in-app drop zone.
 *
 * We intercept both: external links open in the system browser, and stray
 * file drops are cancelled.
 */
export function installWebviewGuards(): void {
  // ── Link clicks ──────────────────────────────────────────────────────────
  // Capture phase so this runs before component handlers.
  document.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      const anchor = target?.closest?.("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Leave in-page anchors, downloads and inline data/blob links untouched.
      if (
        href.startsWith("#") ||
        href.startsWith("blob:") ||
        href.startsWith("data:") ||
        href.startsWith("javascript:") ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Everything else would hijack the app window — open it externally.
      e.preventDefault();
      const url = /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`;
      void import("@tauri-apps/plugin-shell").then(({ open }) => open(url)).catch(() => {});
    },
    true,
  );

  // ── File drops ───────────────────────────────────────────────────────────
  // Only intercept OS file drags. Internal drag-and-drop (e.g. the file tree,
  // which uses custom "application/x-vibe-*" mime types) is left alone so its
  // own handlers keep working.
  const cancelFileDrag = (e: DragEvent) => {
    if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
  };
  window.addEventListener("dragover", cancelFileDrag);
  window.addEventListener("drop", cancelFileDrag);
}
