import type { VibeConfig } from "@/workbench/services/aiProviders/common/aiProvider";
import type { ChatSummary } from "@/workbench/services/chat/common/chat";
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

export const browserPreviewProjects: Project[] = [
  browserPreviewProject,
  {
    id: "dev-preview-browser-runtime",
    path: "/home/developer/browser-runtime",
    name: "Browser Runtime",
    color: "#8b8b8b",
    addedAt: Date.now() - 60_000,
  },
  {
    id: "dev-preview-design-system",
    path: "/home/developer/design-system",
    name: "Design System",
    color: "#8b8b8b",
    addedAt: Date.now() - 120_000,
  },
];

const previewNow = Date.now();

export const browserPreviewChatsByProject: Record<string, ChatSummary[]> = {
  [browserPreviewProject.id]: [
    {
      id: "preview-sidebar-redesign",
      title: "Redesign the projects sidebar",
      createdAt: previewNow - 52 * 60_000,
      updatedAt: previewNow - 3 * 60_000,
      messageCount: 18,
      pinned: true,
    },
    {
      id: "preview-command-search",
      title: "Add a global chat search",
      createdAt: previewNow - 5 * 60 * 60_000,
      updatedAt: previewNow - 42 * 60_000,
      messageCount: 11,
    },
    {
      id: "preview-layout-tests",
      title: "Verify responsive workbench layout",
      createdAt: previewNow - 28 * 60 * 60_000,
      updatedAt: previewNow - 22 * 60 * 60_000,
      messageCount: 9,
    },
    {
      id: "preview-provider-errors",
      title: "Trace provider connection errors",
      createdAt: previewNow - 6 * 24 * 60 * 60_000,
      updatedAt: previewNow - 3 * 24 * 60 * 60_000,
      messageCount: 23,
    },
    {
      id: "preview-release-notes",
      title: "Prepare the next release notes",
      createdAt: previewNow - 12 * 24 * 60 * 60_000,
      updatedAt: previewNow - 8 * 24 * 60 * 60_000,
      messageCount: 7,
    },
  ],
  "dev-preview-browser-runtime": [
    {
      id: "preview-browser-lifecycle",
      title: "Simplify browser session lifecycle",
      createdAt: previewNow - 3 * 60 * 60_000,
      updatedAt: previewNow - 18 * 60_000,
      messageCount: 14,
    },
    {
      id: "preview-screencast",
      title: "Improve screencast recovery",
      createdAt: previewNow - 2 * 24 * 60 * 60_000,
      updatedAt: previewNow - 26 * 60 * 60_000,
      messageCount: 16,
    },
  ],
  "dev-preview-design-system": [
    {
      id: "preview-theme-surfaces",
      title: "Unify canvas and overlay surfaces",
      createdAt: previewNow - 3 * 24 * 60 * 60_000,
      updatedAt: previewNow - 2 * 60 * 60_000,
      messageCount: 12,
    },
  ],
};
