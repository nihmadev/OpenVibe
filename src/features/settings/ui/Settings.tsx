import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ConnectPopup } from "@/features/providers/ui/ConnectPopup/ConnectPopup";
import { useI18n } from "@/shared/i18n/useI18n";
import "./Settings.css";
import { CodeTab } from "./CodeTab";
import { DesignTab } from "./DesignTab";
import { GeneralTab } from "./GeneralTab";
import { HotkeysTab } from "./HotkeysTab";
import { McpSettingsPanel } from "./McpSettingsPanel";
import { ModelsTab } from "./ModelsTab";
import { ProvidersTab } from "./ProvidersTab";
import { SettingsSidebar } from "./SettingsSidebar";
import type { SettingsProps, SettingsTab } from "./types";
import { useGeneralSettings } from "./useGeneralSettings";
import { useProviderSettings } from "./useProviderSettings";
import { useShortcutRecording } from "./useShortcutRecording";

export function Settings({
  open,
  onClose,
  onProviderChanged,
  activeTab = "general",
  onTabChange,
  onLanguageChange,
  shortcuts,
  onUpdateBinding,
  onResetBinding,
}: SettingsProps): React.ReactElement | null {
  const { t } = useI18n();
  const { general, updateGeneral } = useGeneralSettings(onLanguageChange);
  const providers = useProviderSettings(open, onProviderChanged);
  const recording = useShortcutRecording(open, onUpdateBinding);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [searchStuck, setSearchStuck] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || activeTab !== "models") {
      setSearchStuck(false);
      return;
    }
    const handleScroll = () => setSearchStuck(body.scrollTop > 0);
    body.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => body.removeEventListener("scroll", handleScroll);
  }, [activeTab]);

  if (!open) return null;

  const labels: Record<SettingsTab, string> = {
    general: t("general"),
    design: t("design"),
    code: t("codeTab"),
    providers: t("providers"),
    models: t("models"),
    hotkeys: t("hotkeys"),
    mcp: t("mcpServers"),
  };

  const selectTab = (tab: SettingsTab) => {
    onTabChange?.(tab);
    providers.setEditing(null);
  };

  return (
    <div className="settings__overlay" onClick={onClose}>
      <div className="settings__container" onClick={(event) => event.stopPropagation()}>
        <SettingsSidebar activeTab={activeTab} onSelect={selectTab} />
        <div className="settings__content">
          <div className="settings__content-header">
            <h2>{labels[activeTab]}</h2>
            <button className="settings__close" onClick={onClose}>
              ×
            </button>
          </div>
          <div
            className={`settings__content-body${searchStuck ? " settings__content-body--search-stuck" : ""}`}
            ref={bodyRef}
          >
            {activeTab === "general" && (
              <GeneralTab general={general} updateGeneral={updateGeneral} onClose={onClose} />
            )}
            {activeTab === "design" && <DesignTab general={general} updateGeneral={updateGeneral} />}
            {activeTab === "code" && <CodeTab general={general} updateGeneral={updateGeneral} />}
            {activeTab === "providers" && (
              <ProvidersTab
                connected={providers.connected}
                onEdit={providers.startEdit}
                onDisconnect={providers.disconnect}
                onCustom={() => providers.setEditing({ template: null, custom: true })}
                onConnect={(template) => providers.setEditing({ template, custom: false })}
              />
            )}
            {activeTab === "models" && (
              <ModelsTab
                models={providers.discoveredModels}
                loading={providers.modelsLoading}
                enabledModels={providers.enabledModels}
                search={providers.modelsSearch}
                setSearch={providers.setModelsSearch}
                collapsed={providers.collapsedProviders}
                setCollapsed={providers.setCollapsedProviders}
                onToggle={providers.toggleModel}
              />
            )}
            {activeTab === "mcp" && <McpSettingsPanel />}
            {activeTab === "hotkeys" && (
              <HotkeysTab
                shortcuts={shortcuts}
                recordingId={recording.recordingId}
                setRecordingId={recording.setRecordingId}
                errorMsg={recording.errorMsg}
                setErrorMsg={recording.setErrorMsg}
                onResetBinding={onResetBinding}
              />
            )}
          </div>
        </div>
      </div>
      {providers.editing && (
        <ConnectPopup
          template={providers.editing.template}
          custom={providers.editing.custom}
          editId={providers.editing.editId}
          editProvider={
            providers.editing.editId
              ? providers.providers.find((provider) => provider.id === providers.editing?.editId)
              : null
          }
          onConnect={providers.connect}
          onClose={() => providers.setEditing(null)}
        />
      )}
    </div>
  );
}
