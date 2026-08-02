// Project edit workflow: track the project being edited and refresh the
// project list after a save without exposing the gateway to UI/shell code.
import { useCallback, useState } from "react";
import { projectsGateway } from "../infrastructure/projectsGateway";
import type { Project } from "../model/project";

export function useProjectEdit(onProjectsChanged?: (projects: Project[]) => void) {
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  const startEdit = useCallback((project: Project) => {
    setEditingProject(project);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingProject(null);
  }, []);

  const completeEdit = useCallback(async () => {
    setEditingProject(null);
    const list = await projectsGateway.list();
    onProjectsChanged?.(list);
  }, [onProjectsChanged]);

  return { editingProject, startEdit, cancelEdit, completeEdit };
}
