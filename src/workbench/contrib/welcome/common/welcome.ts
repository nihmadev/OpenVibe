import type { Project } from "@/workbench/services/workspace/common/workspace";

export interface OnboardingViewProps {
  onComplete: () => void;
  onLanguageChange: (lang: string) => void;
}

export type WorkspaceChangeHandler = (newFolder: string | null, projectId: string | null) => Promise<void>;

export interface WorkspaceWelcomeViewProps {
  projects: Project[];
  activeProject: string | null;
  handlePickProject: (id: string, onProjectChange: WorkspaceChangeHandler) => void | Promise<void>;
  handleAddProject: (onProjectChange: WorkspaceChangeHandler) => void | Promise<void>;
  handleCloseProject: () => void;
  handleRemoveProject: (id: string, onProjectChange: WorkspaceChangeHandler) => void | Promise<void>;
  onProjectChange: WorkspaceChangeHandler;
  setSettingsOpen: (open: boolean) => void;
  removingIds?: Set<string>;
}
