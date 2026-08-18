import { Button } from "@zazaru/ui";
import type React from "react";
import { FolderOpenStrokeIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import { SidebarView } from "@/workbench/browser/parts/sidebar/sidebarView";
import "./workspaceWelcomeView.css";
import type { WorkspaceWelcomeViewProps } from "../common/welcome";

export function WorkspaceWelcomeView({
  projects,
  activeProject,
  handlePickProject,
  handleAddProject,
  handleCloseProject,
  handleRemoveProject,
  onProjectChange,
  setSettingsOpen,
  removingIds,
}: WorkspaceWelcomeViewProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="welcome">
      <div className="welcome__main">
        <SidebarView
          open={true}
          width={240}
          onResize={() => {}}
          projects={projects}
          activeProjectId={activeProject}
          activeChatId={null}
          onPickProject={(id) => handlePickProject(id, onProjectChange)}
          onAddProject={() => handleAddProject(onProjectChange)}
          onCloseProject={handleCloseProject}
          onRemoveProject={(id) => handleRemoveProject(id, onProjectChange)}
          onPickChat={(projectId) => {
            if (projectId) {
              handlePickProject(projectId, onProjectChange);
            }
          }}
          onNewChat={() => handleAddProject(onProjectChange)}
          onDeleteChat={() => {}}
          onOpenSettings={() => setSettingsOpen(true)}
          removingIds={removingIds}
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
              icon={<FolderOpenStrokeIcon size={16} strokeWidth={1.7} aria-hidden="true" />}
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
