// Hover preview: when the pointer rests on a project in the rail, show that
// project's chats in the sidebar without switching the active project.
import { useCallback, useRef, useState } from "react";
import type { Project } from "@/features/projects/model/project";
import type { ChatSummary } from "../model/chat";
import { listProjectChats } from "./chatWorkspace";

export function useProjectChatsPreview(projects: Project[]) {
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [hoveredChats, setHoveredChats] = useState<ChatSummary[]>([]);
  const hoveredProjectIdRef = useRef<string | null>(null);

  const hoverProject = useCallback(
    async (id: string | null) => {
      hoveredProjectIdRef.current = id;
      if (!id) {
        setHoveredProject(null);
        setHoveredChats([]);
        return;
      }
      const proj = projects.find((p) => p.id === id) ?? null;
      setHoveredProject(proj);
      if (proj) {
        const list = await listProjectChats(proj.id);
        // Guard against race condition: only apply the result if the user
        // is still hovering over the same project that initiated this request.
        if (hoveredProjectIdRef.current !== id) return;
        setHoveredChats(list);
      }
    },
    [projects],
  );

  const dropChatFromPreview = useCallback((chatId: string) => {
    setHoveredChats((prev) => prev.filter((c) => c.id !== chatId));
  }, []);

  return { hoveredProject, hoveredChats, hoverProject, dropChatFromPreview };
}
