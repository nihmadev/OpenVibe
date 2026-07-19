import React from "react";
import { FolderOpen } from "lucide-react";
import { ProjectRail } from "../ProjectRail/ProjectRail.js";
import { Button } from "../ui/Button.js";
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
          <section className="welcome__hero" aria-labelledby="welcome-title">
            <div className="welcome__icon" aria-hidden="true">
              ?
            </div>

            <div className="welcome__copy">
              <h1 className="welcome__title" id="welcome-title">
                {t("openProject")}
              </h1>
              <p className="welcome__subtitle">{t("welcomeSubtitle")}</p>
            </div>

            <Button
              className="welcome__action"
              variant="primary"
              icon={<FolderOpen size={16} strokeWidth={1.7} aria-hidden="true" />}
              onClick={() => handleAddProject(onProjectChange)}
            >
              {t("openFolder")}
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
