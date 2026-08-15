import { Button, Select, Toggle } from "@zazaru/ui";
import { ControlRow } from "@zazaru/ui/recipes";
import type React from "react";
import { languageOptions } from "@/shared/i18n";
import { useI18n } from "@/shared/i18n/useI18n";
import type { GeneralSettings, UpdateGeneral } from "./types";

interface Props {
  general: GeneralSettings;
  updateGeneral: UpdateGeneral;
  onClose: () => void;
}

export function GeneralTab({ general, updateGeneral, onClose }: Props): React.ReactElement {
  const { t } = useI18n();
  const toggle = (key: keyof GeneralSettings, label: string, description: string) => (
    <ControlRow label={t(label)} description={t(description)}>
      <Toggle checked={general[key] as boolean} onValueChange={(checked) => updateGeneral(key, checked)} />
    </ControlRow>
  );
  return (
    <>
      <div className="settings__subsection">
        <div className="settings__control-group">
          <ControlRow label={t("language")} description={t("languageDesc")}>
            <Select
              value={general.language}
              options={languageOptions.map((option) => {
                const label = String(t(`lang${option.value}`) || option.value);
                return { value: option.value, label: label.charAt(0).toUpperCase() + label.slice(1) };
              })}
              onChange={(value) => updateGeneral("language", value)}
            />
          </ControlRow>
          {toggle("autoAccept", "autoAccept", "autoAcceptDesc")}
          <ControlRow label={t("terminalShell")} description={t("terminalShellDesc")}>
            <Select
              value={general.terminalShell}
              options={[
                { value: "powershell", label: "PowerShell" },
                { value: "cmd", label: "CMD" },
                { value: "bash", label: "Bash" },
              ]}
              onChange={(value) => updateGeneral("terminalShell", value)}
            />
          </ControlRow>
          {toggle("showThinking", "showThinking", "showThinkingDesc")}
          {toggle("renderFileTree", "renderFileTree", "renderFileTreeDesc")}
          {toggle("promptMarkdown", "promptMarkdown", "promptMarkdownDesc")}
          {toggle("promptMarkdownGhost", "promptMarkdownGhost", "promptMarkdownGhostDesc")}
          {toggle("useRegionalProxy", "useRegionalProxy", "useRegionalProxyDesc")}
          <ControlRow label={t("rerunOnboarding")} description={t("rerunOnboardingDesc")}>
            <Button
              variant="secondary"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent("vibe:open-welcome-screen"));
              }}
            >
              {t("rerunOnboarding")}
            </Button>
          </ControlRow>
        </div>
      </div>
      <div className="settings__subsection">
        <div className="settings__subsection-title">{t("soundNotifications")}</div>
        <div className="settings__control-group">
          {toggle("soundEnabled", "soundEnabled", "soundEnabledDesc")}
          {toggle("soundOnComplete", "soundOnComplete", "soundOnCompleteDesc")}
          {toggle("soundOnStop", "soundOnStop", "soundOnStopDesc")}
        </div>
      </div>
    </>
  );
}
