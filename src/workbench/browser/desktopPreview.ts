import type { VibeConfig } from "@/workbench/services/aiProviders/common/aiProvider";
import type { Project } from "@/workbench/services/workspace/common/workspace";

/**
 * Browser-only preview used by the Vite development server.
 *
 * The production app always runs inside Tauri. Keeping this check both
 * development-only and Tauri-aware prevents the preview data from leaking into
 * packaged builds or replacing the native runtime during `tauri dev`.
 */
export const isBrowserDevPreview =
  import.meta.env.DEV && typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);

export const browserPreviewConfig: VibeConfig = {
  model: "claude-sonnet-4-5",
  baseUrl: "https://api.anthropic.com",
  cwd: "/home/developer/OpenVibe",
  autoApprove: false,
  apiKey: "",
  providerId: "anthropic",
  reasoningEffort: "high",
};

export const browserPreviewProject: Project = {
  id: "dev-preview-openvibe",
  path: browserPreviewConfig.cwd,
  name: "OpenVibe",
  color: "#fab283",
  addedAt: Date.now(),
};
