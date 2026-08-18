import type React from "react";
import { CodeIcon, LightbulbIcon, RefreshCwStrokeIcon, SearchStrokeIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import "./emptyWorkspace.css";
import type { EmptyWorkspaceViewProps } from "../../common/chat";

export function EmptyWorkspaceView({ projectName, onSelectPrompt }: EmptyWorkspaceViewProps): React.ReactElement {
  const { t } = useI18n();
  const suggestions = [
    { key: "explore", icon: <SearchStrokeIcon size={16} />, label: t("emptyWorkspaceExplore") },
    { key: "build", icon: <LightbulbIcon size={16} />, label: t("emptyWorkspaceBuild") },
    { key: "review", icon: <RefreshCwStrokeIcon size={16} />, label: t("emptyWorkspaceReview") },
    { key: "fix", icon: <CodeIcon size={16} />, label: t("emptyWorkspaceFix") },
  ];

  return (
    <section className="empty-workspace" aria-label={t("emptyWorkspaceTitle", { project: projectName })}>
      <img className="empty-workspace__mark" src="/icons/etc/icon.png" alt="" aria-hidden="true" />
      <h1 className="empty-workspace__title">{t("emptyWorkspaceTitle", { project: projectName })}</h1>
      <div className="empty-workspace__suggestions">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.key}
            type="button"
            className="empty-workspace__suggestion"
            onClick={() => onSelectPrompt(suggestion.label)}
          >
            <span className={`empty-workspace__suggestion-icon empty-workspace__suggestion-icon--${suggestion.key}`}>
              {suggestion.icon}
            </span>
            <span>{suggestion.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
