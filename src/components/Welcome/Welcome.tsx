import React from "react";
import { ProjectRail } from "../ProjectRail/ProjectRail.js";
import type { Project } from "../../types.js";
import { useI18n } from "../../hooks/useI18n.js";
import "./Welcome.css";

interface WelcomeProps {
  projects: Project[];
  activeProject: string | null;
  handlePickProject: (id: string, cb: any) => void;
  handleAddProject: (cb: any) => void;
  handleCloseProject: () => void;
  handleRemoveProject: (id: string, cb: any) => void;
  onProjectChange: (newFolder: string | null, projectId: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
}

export function Welcome({
  projects,
  activeProject,
  handlePickProject,
  handleAddProject,
  handleCloseProject,
  handleRemoveProject,
  onProjectChange,
  setSettingsOpen,
}: WelcomeProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="welcome">
      <div className="welcome__main">
        <ProjectRail
          projects={projects}
          activeId={activeProject}
          onPick={(id) => handlePickProject(id, onProjectChange)}
          onHover={() => {}}
          onAdd={() => handleAddProject(onProjectChange)}
          onClose={handleCloseProject}
          onRemove={(id) => handleRemoveProject(id, onProjectChange)}
          onSettings={() => setSettingsOpen(true)}
        />
        <div className="welcome__content">
          <div className="welcome__title">{t("welcomeTitle")}</div>
          <div className="welcome__subtitle">{t("welcomeSubtitle")}</div>
          <button className="welcome__btn" onClick={() => handleAddProject(onProjectChange)}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M1.5 4.5h4l1.5 1.5h7.5v7a1 1 0 0 1-1 1h-12a1 1 0 0 1-1-1v-8.5z" />
            </svg>
            {t("openProject")}
          </button>
        </div>
      </div>
    </div>
  );
}
