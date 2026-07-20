import { invoke } from "@tauri-apps/api/core";

export async function writeClipboard(text: string): Promise<boolean> {
  // 1) Custom wl-copy command (uses data-device protocol, works on Niri/Wayland)
  try {
    await invoke("clipboard_write_text", { text });
    return true;
  } catch (e) {
    console.error("[clipboard] wl-copy command failed:", e);
  }

  // 2) Tauri clipboard plugin (works on macOS/Windows/X11)
  try {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
    return true;
  } catch (e) {
    console.error("[clipboard] Tauri plugin failed:", e);
  }

  // 3) Web Clipboard API (browser/webview fallback)
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    console.error("[clipboard] Web API failed:", e);
  }

  // 4) Legacy execCommand fallback
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    if (ok) return true;
    console.error("[clipboard] execCommand returned false");
  } catch (e) {
    console.error("[clipboard] execCommand failed:", e);
  }

  return false;
}
