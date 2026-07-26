import { useState, useCallback, useRef } from "react";
import type { Project } from "../types.js";

/** Duration of the fade-out animation for removed project tiles (ms). */
const REMOVE_ANIM_MS = 350;

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  /** IDs of projects currently being animated out (folder missing). */
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  /** Guard against concurrent validateProjectPaths calls. */
  const validating = useRef(false);

  /** Check whether a project folder still exists on disk. */
  const pathExists = useCallback(async (path: string): Promise<boolean> => {
    try {
      const res = await window.vibe.fs.list(path);
      return !!res?.ok;
    } catch {
      return false;
    }
  }, []);

  /**
   * Remove a single project with a fade-out animation.
   * Returns the next active project (or null).
   */
  const animateRemove = useCallback(
    async (id: string, onProjectChange?: (folder: string | null, projectId: string | null) => Promise<void>) => {
      setRemovingIds((prev) => new Set(prev).add(id));

      await new Promise((r) => setTimeout(r, REMOVE_ANIM_MS));

      const next = await window.vibe.projects.remove(id);
      const list = await window.vibe.projects.list();

      setRemovingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      setProjects(list);

      if (onProjectChange) {
        if (next) {
          setActiveProject(next.id);
          setFolder(next.path);
          await onProjectChange(next.path, next.id);
        } else {
          setActiveProject(null);
          setFolder(null);
          await onProjectChange(null, null);
        }
      }

      return next;
    },
    [],
  );

  const handlePickProject = useCallback(
    async (id: string, onProjectChange: (folder: string, projectId: string) => Promise<void>) => {
      if (id === activeProject) return;

      // Find the project in the list to validate its path
      const target = projects.find((p) => p.id === id);
      if (target) {
        const exists = await pathExists(target.path);
        if (!exists) {
          // Folder was deleted — animate removal instead of switching
          await animateRemove(id, onProjectChange as any);
          return;
        }
      }

      const project = await window.vibe.projects.setActive(id);
      if (!project) return;
      setActiveProject(project.id);
      setFolder(project.path);
      await onProjectChange(project.path, project.id);
    },
    [activeProject, projects, pathExists, animateRemove],
  );

  const handleAddProject = useCallback(
    async (onProjectChange: (folder: string, projectId: string) => Promise<void>) => {
      const project = await window.vibe.projects.add();
      if (!project) return;
      const list = await window.vibe.projects.list();
      setProjects(list);
      setActiveProject(project.id);
      setFolder(project.path);
      await onProjectChange(project.path, project.id);
    },
    [],
  );

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

  /**
   * Validate all project paths and auto-remove any whose folders no longer exist.
   * Called once on app init.
   */
  const validateProjectPaths = useCallback(
    async (
      projectList: Project[],
      onProjectChange?: (folder: string | null, projectId: string | null) => Promise<void>,
    ) => {
      if (validating.current) return;
      validating.current = true;

      try {
        const checks = await Promise.all(
          projectList.map(async (p) => ({ id: p.id, exists: await pathExists(p.path) })),
        );
        const missing = checks.filter((c) => !c.exists);
        if (missing.length === 0) return;

        // Animate all missing projects out simultaneously
        setRemovingIds((prev) => {
          const s = new Set(prev);
          for (const m of missing) s.add(m.id);
          return s;
        });

        await new Promise((r) => setTimeout(r, REMOVE_ANIM_MS));

        // Remove them from the backend one by one
        let lastNext: Project | null = null;
        for (const m of missing) {
          const next = await window.vibe.projects.remove(m.id);
          if (next) lastNext = next;
        }

        const list = await window.vibe.projects.list();
        setRemovingIds(new Set());
        setProjects(list);

        // If the active project was among the removed ones, switch to the next available
        if (onProjectChange && missing.some((m) => m.id === activeProject)) {
          if (lastNext) {
            setActiveProject(lastNext.id);
            setFolder(lastNext.path);
            await onProjectChange(lastNext.path, lastNext.id);
          } else {
            setActiveProject(null);
            setFolder(null);
            await onProjectChange(null, null);
          }
        }
      } finally {
        validating.current = false;
      }
    },
    [activeProject, pathExists],
  );

  return {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    folder,
    setFolder,
    removingIds,
    handlePickProject,
    handleAddProject,
    handleCloseProject,
    handleRemoveProject,
    validateProjectPaths,
  };
}
