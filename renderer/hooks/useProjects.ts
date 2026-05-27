import { useState, useCallback } from "react";
import type { Project } from "../types.js";

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);

  const handlePickProject = useCallback(
    async (id: string, onProjectChange: (folder: string, projectId: string) => Promise<void>) => {
      if (id === activeProject) return;
      const project = await window.vibe.projects.setActive(id);
      if (!project) return;
      setActiveProject(project.id);
      setFolder(project.path);
      await onProjectChange(project.path, project.id);
    },
    [activeProject],
  );

  const handleAddProject = useCallback(async (onProjectChange: (folder: string, projectId: string) => Promise<void>) => {
    const project = await window.vibe.projects.add();
    if (!project) return;
    const list = await window.vibe.projects.list();
    setProjects(list);
    setActiveProject(project.id);
    setFolder(project.path);
    await onProjectChange(project.path, project.id);
  }, []);

  const handleCloseProject = useCallback(async () => {
    await window.vibe.projects.close();
    setActiveProject(null);
    setFolder(null);
  }, []);

  const handleRemoveProject = useCallback(
    async (id: string, onProjectChange: (folder: string | null, projectId: string | null) => Promise<void>) => {
      const next = await window.vibe.projects.remove(id);
      const list = await window.vibe.projects.list();
      setProjects(list);
      if (next) {
        setActiveProject(next.id);
        setFolder(next.path);
        await onProjectChange(next.path, next.id);
      } else {
        setActiveProject(null);
        setFolder(null);
        await onProjectChange(null, null);
      }
    },
    [],
  );

  return {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    folder,
    setFolder,
    handlePickProject,
    handleAddProject,
    handleCloseProject,
    handleRemoveProject,
  };
}
