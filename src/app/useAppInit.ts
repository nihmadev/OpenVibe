import { useEffect } from "react";
import type { HistoryItem } from "@/features/agent/model/history";
import { hydrateRestoredMentions, recordToItems } from "@/features/chats/application/chatHistory";
import { loadChatWorkspace } from "@/features/chats/application/chatWorkspace";
import type { ChatSummary } from "@/features/chats/model/chat";
import { editorGateway } from "@/features/editor/infrastructure/editorGateway";
import { fsApi } from "@/features/files/infrastructure/fsGateway";
import { projectsGateway } from "@/features/projects/infrastructure/projectsGateway";
import type { Project } from "@/features/projects/model/project";
import { restoreLastProvider } from "@/features/providers/application/providerConfig";
import type { VibeConfig } from "@/features/providers/model/provider";
import { initApp } from "./bootstrap";

interface UseAppInitProps {
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

export function useAppInit({
  setConfig,
  setFolder,
  setState,
  setProjects,
  setActiveProject,
  setChats,
  setActiveChat,
  setItems,
  validateProjectPaths,
}: UseAppInitProps) {
  useEffect(() => {
    let cancelled = false;
    initApp().then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState({ kind: "fatal", error: res.error });
        return;
      }
      setConfig(res.config);
      setFolder(res.config.cwd);
      setState({ kind: "ok" });

      // Parallel IPC calls — providers, projects, and active project are independent
      const [restoredProvider, projectList, activeProject] = await Promise.all([
        restoreLastProvider(),
        projectsGateway.list(),
        projectsGateway.active(),
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
        editorGateway.preloadTypes(activeProject.path).catch(() => {}),
        // Prime file tree cache with shallow listing
        fsApi.list(activeProject.path).catch(() => {}),
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
