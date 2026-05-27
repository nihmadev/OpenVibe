import { useEffect } from "react";
import type { VibeConfig, Project } from "../types.js";
import { recordToItems } from "../utils.js";

interface UseAppInitProps {
  setConfig: React.Dispatch<React.SetStateAction<VibeConfig | null>>;
  setFolder: (folder: string | null) => void;
  setState: React.Dispatch<React.SetStateAction<{ kind: "ok" } | { kind: "fatal"; error: string }>>;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (id: string | null) => void;
  setChats: (chats: any[]) => void;
  setActiveChat: (id: string | null) => void;
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
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
}: UseAppInitProps) {
  useEffect(() => {
    let cancelled = false;
    window.vibe.init().then(async (res) => {
      if (cancelled) return;
      if (!res.ok) {
        setState({ kind: "fatal", error: res.error });
        return;
      }
      setConfig(res.config);
      setFolder(res.config.cwd);
      setState({ kind: "ok" });

      // Parallel IPC calls — providers, projects, and active project are independent
      const [providerList, projectList, activeProject] = await Promise.all([
        window.vibe.providers.list(),
        window.vibe.projects.list(),
        window.vibe.projects.active(),
      ]);
      if (cancelled) return;

      // Restore the last saved provider from SQLite
      if (providerList.length > 0) {
        const active = providerList[providerList.length - 1]!;
        window.vibe.setProvider(active.apiKey, active.baseUrl, active.model, active.id);
        setConfig((c) => c ? { ...c, model: active.model, baseUrl: active.baseUrl, apiKey: "***" } : c);
      }

      setProjects(projectList);
      if (!activeProject) return;
      
      setActiveProject(activeProject.id);
      setFolder(activeProject.path);

      const list = await window.vibe.chats.list();
      if (cancelled) return;
      if (list.length === 0) {
        const fresh = await window.vibe.chats.new();
        if (fresh) {
          setChats([fresh]);
          setActiveChat(fresh.id);
        }
      } else {
        setChats(list);
        // Restore last active chat if available, otherwise use most recent
        const restoredId = localStorage.getItem("openvibe:activeChatId");
        const target = (restoredId && list.find((c: any) => c.id === restoredId)) || list[0]!;
        const record = await window.vibe.chats.open(target.id);
        if (cancelled) return;
        setActiveChat(target.id);
        if (record) setItems(recordToItems(record));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
