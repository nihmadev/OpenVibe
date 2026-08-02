import { CODE_FONT_OPTIONS, FONT_OPTIONS } from "@/app/fonts";
import { useI18n } from "@/shared/i18n/useI18n";
import { DownloadIcon, UploadStrokeIcon } from "@/shared/icons/icons";
import { addCustomTheme, parseVSCodeTheme, themes } from "@/shared/themes/themes";
import { useTheme } from "@/shared/themes/useTheme";
import type { AnimStyle } from "@/shared/ui/animations/useAnimations";
import { useAnimations } from "@/shared/ui/animations/useAnimations";
import { ControlRow, NumberInput, Select } from "@/shared/ui/kit";
import { InlineAnimPreview } from "./AnimationPreviewModal";
import type { GeneralSettings, UpdateGeneral } from "./types";

export function DesignTab({ general, updateGeneral }: { general: GeneralSettings; updateGeneral: UpdateGeneral }) {
  const { t } = useI18n();
  const { currentTheme, setTheme, preview, colorScheme, setColorScheme } = useTheme();
  const { settings, set, animMultiplier, setAnimMultiplier } = useAnimations();

  function importTheme(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const customTheme = parseVSCodeTheme(JSON.parse(await file.text()));
        addCustomTheme(customTheme);
        setTheme(customTheme.id);
        console.log("Imported theme", customTheme.name);
      } catch (error) {
        console.error("Failed to parse theme", error);
      }
    };
    input.click();
  }

  function exportTheme(): void {
    const anchor = document.createElement("a");
    anchor.setAttribute(
      "href",
      `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(currentTheme, null, 2))}`,
    );
    anchor.setAttribute("download", `${currentTheme.name.toLowerCase().replace(/\s+/g, "-")}-theme.json`);
    anchor.click();
  }

  return (
    <>
      <div className="settings__subsection" style={{ paddingTop: "var(--settings-py)" }}>
        <div className="settings__control-group">
          <ControlRow label={t("theme")} description={t("themeDesc")}>
            <Select
              value={currentTheme.id}
              options={themes.map((theme) => ({ value: theme.id, label: theme.name }))}
              onChange={setTheme}
              onHover={preview}
            />
          </ControlRow>
          <ControlRow label={t("manageThemes")} description={t("manageThemesDesc")}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="settings__connect-btn" onClick={importTheme}>
                <UploadStrokeIcon size={14} style={{ marginRight: 6 }} /> {t("importTheme")}
              </button>
              <button className="settings__connect-btn" onClick={exportTheme}>
                <DownloadIcon size={14} style={{ marginRight: 6 }} /> {t("exportTheme")}
              </button>
            </div>
          </ControlRow>
          <ControlRow label={t("colorScheme")} description={t("colorSchemeDesc")}>
            <Select
              value={colorScheme}
              options={[
                { value: "dark", label: t("dark") },
                { value: "light", label: t("light") },
                { value: "system", label: t("system") },
              ]}
              onChange={(value) => setColorScheme(value as "dark" | "light" | "system")}
            />
          </ControlRow>
          <ControlRow label={t("font")} description={t("fontDesc")}>
            <Select
              value={general.font}
              options={[
                { value: "Segoe UI", label: "Segoe UI", fontFamily: "Segoe UI" },
                { value: "System", label: t("systemFont") },
                ...FONT_OPTIONS,
              ]}
              onChange={(value) => updateGeneral("font", value)}
            />
          </ControlRow>
          <ControlRow label={t("codeFont")} description={t("codeFontDesc")}>
            <Select
              value={general.codeFont}
              options={[
                { value: "Cascadia Code", label: "Cascadia Code", fontFamily: "Cascadia Code" },
                { value: "Consolas", label: "Consolas", fontFamily: "Consolas" },
                { value: "monospace", label: "Monospace", fontFamily: "monospace" },
                ...CODE_FONT_OPTIONS,
              ]}
              onChange={(value) => updateGeneral("codeFont", value)}
            />
          </ControlRow>
          <ControlRow label={t("borderRadius")} description={t("borderRadiusDesc")}>
            <NumberInput
              value={general.radius}
              step={1}
              min={0}
              max={general.experimentalExtremeRadius ? 100 : 16}
              onChange={(value) => updateGeneral("radius", value)}
            />
          </ControlRow>
          <ControlRow label={t("experimentalExtremeRadius")} description={t("experimentalExtremeRadiusDesc")}>
            <input
              type="checkbox"
              className="settings__checkbox"
              checked={general.experimentalExtremeRadius}
              onChange={(event) => {
                updateGeneral("experimentalExtremeRadius", event.target.checked);
                if (!event.target.checked && (parseFloat(general.radius) || 0) > 16) updateGeneral("radius", "16");
              }}
            />
          </ControlRow>
          <ControlRow label={t("borderStyle")} description={t("borderStyleDesc")}>
            <Select
              value={general.borderStyle}
              options={[
                { value: "bordered", label: t("borderStyleBordered") },
                { value: "borderless", label: t("borderStyleBorderless") },
              ]}
              onChange={(value) => updateGeneral("borderStyle", value)}
            />
          </ControlRow>
          <ControlRow label={t("tabStyle")} description={t("tabStyleDesc")}>
            <Select
              value={general.tabStyle}
              options={[
                { value: "default", label: t("tabStyleDefault") },
                { value: "pills", label: t("tabStylePills") },
              ]}
              onChange={(value) => updateGeneral("tabStyle", value)}
            />
          </ControlRow>
        </div>
      </div>
      <div className="settings__subsection">
        <div className="settings__subsection-title">{t("uiZoom")}</div>
        <div className="settings__control-group">
          <ControlRow label={t("zoomStep")} description={t("zoomStepDesc")}>
            <NumberInput
              value={general.zoomStep}
              step={0.05}
              min={0.05}
              max={1}
              onChange={(v) => updateGeneral("zoomStep", v)}
            />
          </ControlRow>
          <ControlRow label={t("zoomDefault")} description={t("zoomDefaultDesc")}>
            <NumberInput
              value={general.zoomDefault}
              step={0.05}
              min={0.2}
              max={3}
              onChange={(v) => updateGeneral("zoomDefault", v)}
            />
          </ControlRow>
        </div>
      </div>
      <div className="settings__subsection">
        <div className="settings__subsection-title">{t("windowEffects")}</div>
        <div className="settings__control-group">
          <ControlRow label={t("blurOverlay")} description={t("blurOverlayDesc")}>
            <Select
              value={general.blur}
              options={[
                { value: "none", label: t("blurNone") },
                { value: "subtle", label: t("blurSubtle") },
                { value: "strong", label: t("blurStrong") },
              ]}
              onChange={(v) => updateGeneral("blur", v)}
            />
          </ControlRow>
        </div>
      </div>
      <div className="settings__subsection">
        <div className="settings__subsection-title">{t("animations")}</div>
        <div className="settings__anim-cards">
          {(
            [
              ["projectHover", "animProjectHover"],
              ["projectSwitch", "animProjectSwitch"],
              ["sidebarSlide", "animSidebarSlide"],
              ["contextMenu", "animContextMenu"],
              ["buttons", "animButtons"],
              ["panelAppear", "animPanelAppear"],
            ] as const
          ).map(([key, label]) => (
            <div className="settings__anim-card" key={key}>
              <div className="settings__anim-card__preview">
                <InlineAnimPreview animKey={key} animStyle={settings[key]} />
              </div>
              <div className="settings__anim-card__footer">
                <div className="settings__anim-card__label">{t(label)}</div>
                <Select
                  value={settings[key]}
                  options={[
                    { value: "fade", label: t("animStyleFade") },
                    { value: "slide", label: t("animStyleSlide") },
                    { value: "scale", label: t("animStyleScale") },
                    { value: "fade-slide", label: t("animStyleFadeSlide") },
                    { value: "none", label: t("animStyleNone") },
                  ]}
                  onChange={(value) => set(key, value as AnimStyle)}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="settings__control-group" style={{ marginTop: "var(--settings-py)" }}>
          <ControlRow label={t("animMultiplier")} description={t("animMultiplierDesc")}>
            <NumberInput value={animMultiplier} step={0.1} min={0} max={5} onChange={setAnimMultiplier} />
          </ControlRow>
        </div>
      </div>
    </>
  );
}
