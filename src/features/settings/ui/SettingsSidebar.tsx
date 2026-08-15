import type React from "react";
import { useI18n } from "@/shared/i18n/useI18n";
import { CodeIcon, ServerIcon } from "@/shared/icons/icons";
import { interactiveItemClassName, interactiveListClassName, surfaceClassName } from "@/shared/ui/kit";
import type { SettingsTab } from "./types";

interface Props {
  activeTab: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
}

const icons: Record<SettingsTab, React.ReactNode> = {
  general: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15 1.65 1.65 0 0 0 3.17 14H3a2 2 0 0 1 0-4h.17A1.65 1.65 0 0 0 4.68 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.17a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
    </svg>
  ),
  design: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
  ),
  code: <CodeIcon size={14} />,
  hotkeys: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" />
    </svg>
  ),
  providers: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" />
      <line x1="6" y1="6" x2="6" y2="6" />
      <line x1="6" y1="18" x2="6" y2="18" />
    </svg>
  ),
  models: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  mcp: <ServerIcon size={14} />,
};

export function SettingsSidebar({ activeTab, onSelect }: Props): React.ReactElement {
  const { t } = useI18n();
  const item = (id: SettingsTab, label: string) => (
    <button
      className={interactiveItemClassName(
        activeTab === id,
        `settings__sidebar-item ${activeTab === id ? "active" : ""}`,
      )}
      onClick={() => onSelect(id)}
    >
      {icons[id]}
      <span>{label}</span>
    </button>
  );
  return (
    <div className={surfaceClassName("chrome", "settings__sidebar")}>
      <div className={interactiveListClassName("settings__sidebar-group")}>
        <div className="settings__sidebar-title">{t("app")}</div>
        {item("general", t("general"))}
        {item("design", t("design"))}
        {item("code", t("codeTab"))}
        {item("hotkeys", t("hotkeys"))}
      </div>
      <div className={interactiveListClassName("settings__sidebar-group")}>
        <div className="settings__sidebar-title">{t("server")}</div>
        {item("providers", t("providers"))}
        {item("models", t("models"))}
        {item("mcp", t("mcpServers"))}
      </div>
      <div className="settings__sidebar-footer">
        <div className="settings__app-info">
          {t("appName")}
          <span>{t("appVersion")}</span>
        </div>
      </div>
    </div>
  );
}
