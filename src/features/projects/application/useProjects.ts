import { useCallback, useEffect, useRef, useState } from "react";
import { fsApi } from "@/features/files/infrastructure/fsGateway";
import { projectsGateway } from "@/features/projects/infrastructure/projectsGateway";
import type { Project } from "../model/project";

/** Duration of the fade-out animation for removed project tiles (ms). */
const REMOVE_ANIM_MS = 350;

/** How often to check whether project folders still exist (ms). */
const POLL_INTERVAL_MS = 3_000;

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [folder, setFolder] = useState<string | null>(null);
  /** IDs of projects currently being animated out (folder missing). */
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  /** Guard against concurrent validateProjectPaths calls. */
  const validating = useRef(false);
  /**
   * Stable ref to the onProjectChange callback so the polling effect
   * can use it without re-creating the interval on every render.
   */
  const onProjectChangeRef = useRef<((folder: string | null, projectId: string | null) => Promise<void>) | null>(null);

  /** Check whether a project folder still exists on disk. */
  const pathExists = useCallback(async (path: string): Promise<boolean> => {
    try {
      const res = await fsApi.list(path);
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

      const next = await projectsGateway.remove(id);
      const list = await projectsGateway.list();

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
    async (id: string, onProjectChange: (folder: string | null, projectId: string | null) => Promise<void>) => {
      if (id === activeProject) return;

      // Find the project in the list to validate its path
      const target = projects.find((p) => p.id === id);
      if (target) {
        const exists = await pathExists(target.path);
        if (!exists) {
          // Folder was deleted — animate removal instead of switching
          await animateRemove(id, onProjectChange);
          return;
        }
      }

      const project = await projectsGateway.setActive(id);
      if (!project) return;
      setActiveProject(project.id);
      setFolder(project.path);
      await onProjectChange(project.path, project.id);
    },
    [activeProject, projects, pathExists, animateRemove],
  );

  const handleAddProject = useCallback(
    async (onProjectChange: (folder: string | null, projectId: string | null) => Promise<void>) => {
      const project = await projectsGateway.add();
      if (!project) return;
      const list = await projectsGateway.list();
      setProjects(list);
      setActiveProject(project.id);
      setFolder(project.path);
      await onProjectChange(project.path, project.id);
    },
    [],
  );

  const handleCloseProject = useCallback(async () => {
    await projectsGateway.close();
    setActiveProject(null);
    setFolder(null);
  }, []);

  const handleRemoveProject = useCallback(
    async (id: string, onProjectChange: (folder: string | null, projectId: string | null) => Promise<void>) => {
      const next = await projectsGateway.remove(id);
      const list = await projectsGateway.list();
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
   * Called on app init and periodically via the polling effect.
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
          const next = await projectsGateway.remove(m.id);
          if (next) lastNext = next;
        }

        const list = await projectsGateway.list();
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

  /**
   * Store the onProjectChange callback so periodic validation can use it.
   * Must be called once from the consuming component (App.tsx).
   */
  const setOnProjectChange = useCallback((cb: (folder: string | null, projectId: string | null) => Promise<void>) => {
    onProjectChangeRef.current = cb;
  }, []);

  // ── Periodic polling: auto-remove projects whose folders no longer exist ──
  useEffect(() => {
    if (projects.length === 0) return;

    const id = setInterval(() => {
      if (validating.current) return;
      validateProjectPaths(projects, onProjectChangeRef.current ?? undefined);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(id);
  }, [projects, validateProjectPaths]);

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
    setOnProjectChange,
  };
}
