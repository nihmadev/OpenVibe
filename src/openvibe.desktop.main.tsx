import { createRoot } from "react-dom/client";
import "@/platform/theme/globalStyles.css";
import "@/base/browser/ui/scrollbar.css";
import "@/workbench/browser/workbench.css";
import { initZoomConfig, zoomDefault, zoomStep } from "@/platform/configuration/browser/zoomConfiguration";
import { tauriKeyValueStore } from "@/platform/native/tauri/keyValueStoreService";
import { addBeforeUnloadCleanup, cleanupTauriListeners } from "@/platform/native/tauri/listenerRegistry";
import { windowApi } from "@/platform/native/tauri/windowService";
import { registerWorkspaceEventBridge } from "@/platform/native/tauri/workspaceEventBridge";
import { registerKeyValueStore } from "@/platform/storage/common/keyValueStore";
import { initFonts } from "@/platform/theme/fontService";
import { DesktopApplication, type DesktopContributions } from "@/workbench/browser/desktopApplication";
import { browserPreviewConfig, isBrowserDevPreview } from "@/workbench/browser/desktopPreview";
import type { WorkbenchInitializationResult } from "@/workbench/browser/useWorkbenchInitialization";
import { onBrowserSessionVisibility } from "@/workbench/contrib/browser/browser/browserEventService";
import { BrowserPane } from "@/workbench/contrib/browser/browser/browserPane";
import { ChatView } from "@/workbench/contrib/chat/browser/chatView/chatView";
import { Composer } from "@/workbench/contrib/chat/browser/composer/composer";
import { EmptyWorkspaceView } from "@/workbench/contrib/chat/browser/emptyWorkspace/emptyWorkspace";
import { SubAgentView } from "@/workbench/contrib/chat/browser/subAgentView/subAgentView";
import { TodoView } from "@/workbench/contrib/chat/browser/todo/todo";
import { ExplorerView } from "@/workbench/contrib/explorer/browser/fileTree/fileTree";
import { McpSettingsPane } from "@/workbench/contrib/mcp/browser/mcpSettingsPane";
import { PreferencesDialog } from "@/workbench/contrib/preferences/browser/preferencesDialog";
import { QuickAccessDialog } from "@/workbench/contrib/quickAccess/browser/quickAccessDialog";
import { ScmView } from "@/workbench/contrib/scm/browser/scmView";
import { SearchView } from "@/workbench/contrib/search/browser/searchView";
import { TerminalView } from "@/workbench/contrib/terminal/browser/terminalView/terminalView";
import { OnboardingView } from "@/workbench/contrib/welcome/browser/onboardingView";
import { WorkspaceWelcomeView } from "@/workbench/contrib/welcome/browser/workspaceWelcomeView";
import { EditWorkspaceDialog } from "@/workbench/contrib/workspaces/browser/editWorkspaceDialog";
import { onAgentEvent } from "@/workbench/services/agent/browser/agentEventService";
import { registerAgentEventBridge } from "@/workbench/services/agent/tauri/agentEventBridge";
import { initializeAgentRuntime } from "@/workbench/services/agent/tauri/agentRuntimeService";
import { getCurrentConfig } from "@/workbench/services/aiProviders/tauri/aiProviderRuntimeState";
import { registerChatAutosave, restoreLastActiveChat } from "@/workbench/services/chat/browser/chatPersistence";

registerKeyValueStore(
  isBrowserDevPreview
    ? {
        async get(key) {
          return key === "onboarding:completed" ? "true" : null;
        },
        async set() {
          // Browser-preview settings intentionally remain ephemeral.
        },
      }
    : tauriKeyValueStore,
);

let chatAutosaveRegistered = false;

async function initializeWorkbench(): Promise<WorkbenchInitializationResult> {
  if (isBrowserDevPreview) return { ok: true, config: browserPreviewConfig };

  await initializeAgentRuntime();
  const currentConfig = getCurrentConfig();
  if (!currentConfig) return { ok: false, error: "Failed to load config" };

  await cleanupTauriListeners();
  await registerAgentEventBridge();
  await registerWorkspaceEventBridge();
  addBeforeUnloadCleanup();

  if (!chatAutosaveRegistered) {
    chatAutosaveRegistered = true;
    registerChatAutosave((listener) =>
      onAgentEvent((event) => {
        if (event.kind === "done") listener();
      }),
    );
  }
  await restoreLastActiveChat();

  return {
    ok: true,
    config: { ...currentConfig, apiKey: currentConfig.apiKey ? "***" : "" },
  };
}

const desktopContributions: DesktopContributions = {
  subscribeBrowserSessionVisibility: onBrowserSessionVisibility,
  workbench: {
    ChatView,
    Composer,
    EmptyWorkspaceView,
    SubAgentView,
    TodoView,
    ExplorerView,
    SearchView,
    ScmView,
    TerminalView,
    BrowserView: BrowserPane,
    EditWorkspaceDialog,
  },
  renderOnboarding: (props) => <OnboardingView {...props} />,
  renderWorkspaceWelcome: (props) => <WorkspaceWelcomeView {...props} />,
  renderQuickAccess: (props) => <QuickAccessDialog {...props} />,
  renderPreferences: (props) => <PreferencesDialog {...props} mcpSettingsPane={<McpSettingsPane />} />,
};

initFonts();
initZoomConfig();

let zoomFactor = zoomDefault;
document.addEventListener("keydown", (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;
  if (e.key === "=" || e.key === "+") {
    e.preventDefault();
    zoomFactor = Math.min(3.0, zoomFactor + zoomStep);
    windowApi.zoom(zoomFactor);
  } else if (e.key === "-") {
    e.preventDefault();
    zoomFactor = Math.max(0.2, zoomFactor - zoomStep);
    windowApi.zoom(zoomFactor);
  } else if (e.key === "0") {
    e.preventDefault();
    zoomFactor = zoomDefault;
    windowApi.zoom(zoomFactor);
  }
});

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <DesktopApplication contributions={desktopContributions} initializeWorkbench={initializeWorkbench} />,
);
