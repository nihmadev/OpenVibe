import { useEffect } from "react";
import type { HistoryItem } from "@/workbench/common/conversation";
import { restoreLastProvider } from "@/workbench/services/aiProviders/browser/aiProviderConfiguration";
import type { VibeConfig } from "@/workbench/services/aiProviders/common/aiProvider";
import { hydrateRestoredMentions, recordToItems } from "@/workbench/services/chat/browser/chatHistory";
import { loadChatWorkspace } from "@/workbench/services/chat/browser/chatWorkspace";
import type { ChatSummary } from "@/workbench/services/chat/common/chat";
import { fileService } from "@/workbench/services/files/tauri/fileService";
import { typeDefinitionService } from "@/workbench/services/languageServer/tauri/typeDefinitionService";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import { workspaceService } from "@/workbench/services/workspace/tauri/workspaceService";
import { browserPreviewProject, isBrowserDevPreview } from "./desktopPreview";

export type WorkbenchInitializationResult = { ok: true; config: VibeConfig } | { ok: false; error: string };

interface UseWorkbenchInitializationProps {
  initializeWorkbench: () => Promise<WorkbenchInitializationResult>;
  setConfig: React.Dispatch<React.SetStateAction<VibeConfig | null>>;
  setFolder: (folder: string | null) => void;
  setState: React.Dispatch<React.SetStateAction<{ kind: "ok" } | { kind: "fatal"; error: string } | null>>;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (id: string | null) => void;
  setChats: (chats: ChatSummary[]) => void;
  setActiveChat: (id: string | null) => void;
  setItems: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  validateProjectPaths: (
    projects: Project[],
    onProjectChange?: (folder: string | null, projectId: string | null) => Promise<void>,
  ) => Promise<void>;
}

export function useWorkbenchInitialization({
  initializeWorkbench,
  setConfig,
  setFolder,
  setState,
  setProjects,
  setActiveProject,
  setChats,
  setActiveChat,
  setItems,
  validateProjectPaths,
}: UseWorkbenchInitializationProps) {
  useEffect(() => {
    let cancelled = false;
    initializeWorkbench().then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState({ kind: "fatal", error: res.error });
        return;
      }
      setConfig(res.config);
      setFolder(res.config.cwd);
      setState({ kind: "ok" });

      if (isBrowserDevPreview) {
        setProjects([browserPreviewProject]);
        setActiveProject(browserPreviewProject.id);
        setFolder(browserPreviewProject.path);
        setChats([]);
        setActiveChat(null);
        setItems([]);
        return;
      }

      // Parallel IPC calls — providers, projects, and active project are independent
      const [restoredProvider, projectList, activeProject] = await Promise.all([
        restoreLastProvider(),
        workspaceService.list(),
        workspaceService.active(),
      ]);
      if (cancelled) return;

      // Restore the last saved provider from SQLite
      if (restoredProvider) {
        setConfig((c) =>
          c ? { ...c, model: restoredProvider.model, baseUrl: restoredProvider.baseUrl, apiKey: "***" } : c,
        );
      }

      setProjects(projectList);

      // Validate project paths in the background — remove any whose folders no longer exist
      if (projectList.length > 0) {
        validateProjectPaths(projectList);
      }

      if (!activeProject) return;

      setActiveProject(activeProject.id);
      setFolder(activeProject.path);

      // Background warm-up tasks — run in parallel without blocking UI
      Promise.all([
        // Preload Monaco editor types for faster code editing
        typeDefinitionService.preloadTypes(activeProject.path).catch(() => {}),
        // Prime file tree cache with shallow listing
        fileService.list(activeProject.path).catch(() => {}),
      ]);

      // Restore last active chat if available, otherwise use most recent
      const workspace = await loadChatWorkspace({ restoreLastActive: true });
      if (cancelled) return;
      setChats(workspace.chats);
      setActiveChat(workspace.activeChatId);
      if (workspace.record) {
        const restoredItems = recordToItems(workspace.record);
        setItems(await hydrateRestoredMentions(restoredItems, activeProject.path));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    initializeWorkbench,
    validateProjectPaths,
    setItems,
    setState,
    setFolder,
    setActiveProject,
    setProjects,
    setConfig,
    setChats,
    setActiveChat,
  ]);
}
