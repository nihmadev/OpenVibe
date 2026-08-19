import { interactiveItemClassName, interactiveListClassName, surfaceClassName } from "@zazaru/ui";
import type React from "react";
import { useMemo, useState } from "react";
import { CodeIcon, ServerIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import type { SettingsTab } from "../common/preferences";

interface Props {
  activeTab: SettingsTab;
  onSelect: (tab: SettingsTab) => void;
  onClose: () => void;
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

export function SettingsSidebar({ activeTab, onSelect, onClose }: Props): React.ReactElement {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = useMemo(
    () => [
      {
        label: t("app"),
        items: [
          ["general", t("general")],
          ["design", t("design")],
          ["code", t("codeTab")],
          ["hotkeys", t("hotkeys")],
        ] as [SettingsTab, string][],
      },
      {
        label: t("server"),
        items: [
          ["providers", t("providers")],
          ["models", t("models")],
          ["mcp", t("mcpServers")],
        ] as [SettingsTab, string][],
      },
    ],
    [t],
  );
  const item = (id: SettingsTab, label: string) => (
    <button
      key={id}
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
    <div className={surfaceClassName("transparent", "settings__sidebar")}>
      <div className="settings__sidebar-header">
        <button className="settings__back" type="button" onClick={onClose} aria-label={t("close")}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span>{t("settings")}</span>
      </div>
      <label className="settings__sidebar-search">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("search")} />
      </label>
      <div className="settings__sidebar-nav">
        {groups.map((group) => {
          const visibleItems = group.items.filter(([, label]) => label.toLocaleLowerCase().includes(normalizedQuery));
          if (visibleItems.length === 0) return null;
          return (
            <div className={interactiveListClassName("settings__sidebar-group")} key={group.label}>
              <div className="settings__sidebar-title">{group.label}</div>
              {visibleItems.map(([id, label]) => item(id, label))}
            </div>
          );
        })}
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
