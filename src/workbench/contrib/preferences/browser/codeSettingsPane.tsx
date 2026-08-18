import { NumberInput, Select, Toggle } from "@zazaru/ui";
import { ControlRow } from "@zazaru/ui/recipes";
import { useI18n } from "@/platform/localization/localizationService";
import type { GeneralSettings, UpdateGeneral } from "../common/preferences";

export function CodeTab({ general, updateGeneral }: { general: GeneralSettings; updateGeneral: UpdateGeneral }) {
  const { t } = useI18n();
  return (
    <div className="settings__subsection" style={{ paddingTop: "var(--settings-py)" }}>
      <div className="settings__control-group">
        <ControlRow label={t("editorFontSize")} description={t("editorFontSizeDesc")}>
          <NumberInput
            value={general.editorFontSize}
            step={1}
            min={8}
            max={32}
            onChange={(v) => updateGeneral("editorFontSize", v)}
          />
        </ControlRow>
        <ControlRow label={t("editorLineHeight")} description={t("editorLineHeightDesc")}>
          <NumberInput
            value={general.editorLineHeight}
            step={0.1}
            min={1}
            max={3}
            onChange={(v) => updateGeneral("editorLineHeight", v)}
          />
        </ControlRow>
        <ControlRow label={t("editorLigatures")} description={t("editorLigaturesDesc")}>
          <Toggle
            checked={general.editorLigatures}
            onValueChange={(checked) => updateGeneral("editorLigatures", checked)}
          />
        </ControlRow>
        <ControlRow label={t("editorCursorStyle")} description={t("editorCursorStyleDesc")}>
          <Select
            value={general.editorCursorStyle}
            options={[
              { value: "line", label: t("cursorLine") },
              { value: "block", label: t("cursorBlock") },
              { value: "underline", label: t("cursorUnderline") },
              { value: "line-thin", label: t("cursorLineThin") },
              { value: "block-outline", label: t("cursorBlockOutline") },
              { value: "underline-thin", label: t("cursorUnderlineThin") },
            ]}
            onChange={(v) => updateGeneral("editorCursorStyle", v)}
          />
        </ControlRow>
        <ControlRow label={t("editorCursorBlink")} description={t("editorCursorBlinkDesc")}>
          <Select
            value={general.editorCursorBlink}
            options={[
              { value: "blink", label: t("blinkBlink") },
              { value: "smooth", label: t("blinkSmooth") },
              { value: "phase", label: t("blinkPhase") },
              { value: "expand", label: t("blinkExpand") },
              { value: "solid", label: t("blinkSolid") },
            ]}
            onChange={(v) => updateGeneral("editorCursorBlink", v)}
          />
        </ControlRow>
      </div>
    </div>
  );
}
