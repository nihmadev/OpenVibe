import { NumberInput, Select, Toggle } from "@zazaru/ui";
import { ControlRow } from "@zazaru/ui/recipes";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DownloadIcon, UploadStrokeIcon } from "@/base/browser/ui/icons/iconRegistry";
import type { AnimStyle } from "@/platform/configuration/browser/animationService";
import { useAnimations } from "@/platform/configuration/browser/animationService";
import { useI18n } from "@/platform/localization/localizationService";
import { CODE_FONT_OPTIONS, FONT_OPTIONS } from "@/platform/theme/fontService";
import { parseVSCodeTheme, type ThemeVars, themes } from "@/platform/theme/themeRegistry";
import { type ColorScheme, type ResolvedScheme, useTheme } from "@/platform/theme/themeService";
import { InlineAnimPreview } from "../../../browser/animationPreview";
import type { GeneralSettings, UpdateGeneral } from "../common/preferences";

const UI_FONT_OPTIONS = [
  { value: "Segoe UI", label: "Segoe UI", fontFamily: "Segoe UI" },
  { value: "System", label: "System" },
  ...FONT_OPTIONS,
];

const MONO_FONT_OPTIONS = [
  { value: "Cascadia Code", label: "Cascadia Code", fontFamily: "Cascadia Code" },
  { value: "Consolas", label: "Consolas", fontFamily: "Consolas" },
  { value: "monospace", label: "Monospace", fontFamily: "monospace" },
  ...CODE_FONT_OPTIONS,
];

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function shiftHex(hex: string, amount: number): string {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return `#${channels
    .map((channel) =>
      Math.max(0, Math.min(255, Math.round(channel + amount)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

function alphaHex(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
}

function rgba(hex: string, alpha: number): string {
  if (!isHexColor(hex)) return `rgba(128, 128, 128, ${alpha})`;
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface HsvColor {
  h: number;
  s: number;
  v: number;
}

function hexToHsv(hex: string): HsvColor {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }
  if (h < 0) h += 360;
  return { h, s: max === 0 ? 0 : (delta / max) * 100, v: max * 100 };
}

function hsvToHex({ h, s, v }: HsvColor): string {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const section = h / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const match = value - chroma;
  let rgb: [number, number, number];
  if (section < 1) rgb = [chroma, x, 0];
  else if (section < 2) rgb = [x, chroma, 0];
  else if (section < 3) rgb = [0, chroma, x];
  else if (section < 4) rgb = [0, x, chroma];
  else if (section < 5) rgb = [x, 0, chroma];
  else rgb = [chroma, 0, x];
  return `#${rgb
    .map((channel) =>
      Math.round((channel + match) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`.toUpperCase();
}

const COLOR_PRESETS = ["#339CFF", "#7C6AF7", "#D05CE3", "#F05A7E", "#F97316", "#EAB308", "#22C55E", "#14B8A6"];

function ColorField({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) {
  const normalized = isHexColor(value) ? value.toUpperCase() : "#808080";
  const [draft, setDraft] = useState(normalized);
  const [hsv, setHsv] = useState<HsvColor>(() => hexToHsv(normalized));
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(normalized);
    setHsv((current) => {
      const next = hexToHsv(normalized);
      return next.s === 0 ? { ...next, h: current.h } : next;
    });
  }, [normalized]);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = 260;
      const height = 350;
      const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
      const top = rect.bottom + 8 + height > window.innerHeight ? Math.max(12, rect.top - height - 8) : rect.bottom + 8;
      setPosition({ top, left });
    };
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    updatePosition();
    document.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape, true);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape, true);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const commit = () => {
    const next = draft.startsWith("#") ? draft : `#${draft}`;
    if (isHexColor(next)) onChange(next.toUpperCase());
    else setDraft(normalized);
  };

  const changeHsv = (next: HsvColor) => {
    const hex = hsvToHex(next);
    setHsv(next);
    setDraft(hex);
    onChange(hex);
  };

  const changeSaturation = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = saturationRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, 100 - ((event.clientY - rect.top) / rect.height) * 100));
    changeHsv({ ...hsv, s, v });
  };

  const changeHue = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const h = Math.max(0, Math.min(359.999, ((event.clientX - rect.left) / rect.width) * 360));
    changeHsv({ ...hsv, h });
  };

  return (
    <div className="settings__color-field">
      <button
        ref={triggerRef}
        className={`settings__color-trigger${open ? " settings__color-trigger--open" : ""}`}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="settings__color-trigger-swatch" style={{ background: normalized }} />
        <span>{normalized}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="settings__color-popover"
            role="dialog"
            aria-label={label}
            style={{ top: position.top, left: position.left }}
          >
            <div className="settings__color-popover-header">
              <span>{label}</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div
              ref={saturationRef}
              className="settings__color-saturation"
              style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                changeSaturation(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) changeSaturation(event);
              }}
              aria-label={`${label}: saturation and brightness`}
            >
              <span
                className="settings__color-pointer"
                style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%`, background: normalized }}
              />
            </div>
            <div
              ref={hueRef}
              className="settings__color-hue"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                changeHue(event);
              }}
              onPointerMove={(event) => {
                if (event.currentTarget.hasPointerCapture(event.pointerId)) changeHue(event);
              }}
              aria-label={`${label}: hue`}
            >
              <span
                className="settings__color-pointer settings__color-pointer--hue"
                style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }}
              />
            </div>
            <div className="settings__color-popover-input-row">
              <span className="settings__color-popover-preview" style={{ background: normalized }} />
              <label>
                <span>HEX</span>
                <input
                  value={draft}
                  maxLength={7}
                  spellCheck={false}
                  onChange={(event) => setDraft(event.target.value)}
                  onBlur={commit}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                  aria-label={`${label} HEX`}
                />
              </label>
            </div>
            <div className="settings__color-presets" aria-label="Color presets">
              {COLOR_PRESETS.map((color) => (
                <button
                  type="button"
                  key={color}
                  style={{ background: color }}
                  onClick={() => {
                    setDraft(color);
                    onChange(color);
                  }}
                  aria-label={color}
                  aria-pressed={normalized === color}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MiniApp({ vars, splitVars }: { vars: ThemeVars; splitVars?: ThemeVars }) {
  const style = {
    "--preview-bg": vars["--bg"],
    "--preview-raised": vars["--bg-3"],
    "--preview-line": vars["--line-strong"],
    "--preview-fg": vars["--fg"],
    "--preview-muted": vars["--fg-muted"],
    "--preview-accent": vars["--accent"],
    "--preview-split-bg": splitVars?.["--bg"] ?? vars["--bg"],
    "--preview-split-raised": splitVars?.["--bg-3"] ?? vars["--bg-3"],
  } as React.CSSProperties;

  return (
    <div className={`settings__theme-mini${splitVars ? " settings__theme-mini--split" : ""}`} style={style}>
      <div className="settings__theme-mini-topbar">
        <span />
        <span />
      </div>
      <div className="settings__theme-mini-window">
        <div className="settings__theme-mini-sidebar">
          <i />
          <i />
          <i />
        </div>
        <div className="settings__theme-mini-main">
          <b />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

function ModeCard({
  mode,
  active,
  label,
  lightVars,
  darkVars,
  onSelect,
}: {
  mode: ColorScheme;
  active: boolean;
  label: string;
  lightVars: ThemeVars;
  darkVars: ThemeVars;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`settings__theme-mode${active ? " settings__theme-mode--active" : ""}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <MiniApp vars={mode === "light" ? lightVars : darkVars} splitVars={mode === "system" ? lightVars : undefined} />
      <span>{label}</span>
    </button>
  );
}

function DiffPane({ vars, added }: { vars: ThemeVars; added?: boolean }) {
  const lines = added
    ? [
        ["2", "surface: ", '"sidebar-elevated",'],
        ["3", "accent: ", `"${vars["--accent"]}",`],
        ["4", "contrast: ", "68,"],
      ]
    : [
        ["2", "surface: ", '"sidebar",'],
        ["3", "accent: ", `"${vars["--accent"]}",`],
        ["4", "contrast: ", "42,"],
      ];
  const tone = added ? vars["--green"] : vars["--red"];

  return (
    <div className="settings__diff-pane" style={{ background: vars["--bg"], color: vars["--fg"] }}>
      <div className="settings__diff-line settings__diff-line--plain">
        <em>1</em>
        <code>
          <span style={{ color: vars["--syntax-keyword"] }}>const</span> themePreview: ThemeConfig = {"{"}
        </code>
      </div>
      {lines.map(([number, property, value]) => (
        <div className="settings__diff-line" key={number} style={{ background: rgba(tone, 0.18), borderColor: tone }}>
          <em>{number}</em>
          <code>
            <span style={{ color: vars["--syntax-property"] }}>{property}</span>
            <span style={{ color: vars["--syntax-string"] }}>{value}</span>
          </code>
        </div>
      ))}
      <div className="settings__diff-line settings__diff-line--plain">
        <em>5</em>
        <code>{"};"}</code>
      </div>
    </div>
  );
}

function DiffPreview({ lightVars, darkVars }: { lightVars: ThemeVars; darkVars: ThemeVars }) {
  return (
    <div className="settings__diff-preview" aria-hidden="true">
      <DiffPane vars={darkVars} />
      <DiffPane vars={lightVars} added />
    </div>
  );
}

export function DesignTab({ general, updateGeneral }: { general: GeneralSettings; updateGeneral: UpdateGeneral }) {
  const { t } = useI18n();
  const {
    colorScheme,
    resolvedScheme,
    setColorScheme,
    setTheme,
    themeForScheme,
    themeVarsFor,
    updateThemeVars,
    resetThemeVars,
    hasThemeOverrides,
    installTheme,
  } = useTheme();
  const { settings, set, animMultiplier, setAnimMultiplier } = useAnimations();
  const lightVars = themeVarsFor("light");
  const darkVars = themeVarsFor("dark");

  function importTheme(scheme: ResolvedScheme): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const customTheme = parseVSCodeTheme(JSON.parse(await file.text()));
        installTheme(customTheme);
        setTheme(customTheme.id, scheme);
      } catch (error) {
        console.error("Failed to parse theme", error);
      }
    };
    input.click();
  }

  function exportTheme(scheme: ResolvedScheme): void {
    const theme = themeForScheme(scheme);
    const effectiveTheme = {
      ...theme,
      darkVars: scheme === "dark" ? themeVarsFor("dark") : theme.darkVars,
      lightVars: scheme === "light" ? themeVarsFor("light") : theme.lightVars,
    };
    const anchor = document.createElement("a");
    anchor.setAttribute(
      "href",
      `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(effectiveTheme, null, 2))}`,
    );
    anchor.setAttribute("download", `${theme.name.toLowerCase().replace(/\s+/g, "-")}-${scheme}-theme.json`);
    anchor.click();
  }

  function updateBaseColor(scheme: ResolvedScheme, key: "accent" | "background" | "foreground", value: string) {
    if (key === "accent") {
      updateThemeVars(scheme, { "--accent": value, "--primary": value, "--toggle-checked": value });
      return;
    }
    if (key === "foreground") {
      updateThemeVars(scheme, {
        "--fg": value,
        "--fg-dim": alphaHex(value, 0.72),
        "--fg-muted": alphaHex(value, 0.52),
      });
      return;
    }
    const direction = scheme === "dark" ? 1 : -1;
    updateThemeVars(scheme, {
      "--bg": value,
      "--bg-2": shiftHex(value, direction * 5),
      "--bg-3": shiftHex(value, direction * 10),
      "--surface-underlay": shiftHex(value, -5),
      "--line": shiftHex(value, direction * 18),
      "--line-strong": shiftHex(value, direction * 30),
    });
  }

  const editor = (scheme: ResolvedScheme) => {
    const vars = scheme === "light" ? lightVars : darkVars;
    const theme = themeForScheme(scheme);
    return (
      <div
        className={`settings__appearance-card${scheme === resolvedScheme ? " settings__appearance-card--active" : ""}`}
        key={scheme}
      >
        <div className="settings__appearance-card-header">
          <strong>{scheme === "light" ? t("appearanceLightTheme") : t("appearanceDarkTheme")}</strong>
          <div className="settings__appearance-card-tools">
            {hasThemeOverrides(scheme) && (
              <button type="button" onClick={() => resetThemeVars(scheme)}>
                {t("restore")}
              </button>
            )}
            <button type="button" onClick={() => importTheme(scheme)}>
              <UploadStrokeIcon size={13} /> {t("importTheme")}
            </button>
            <button type="button" onClick={() => exportTheme(scheme)}>
              <DownloadIcon size={13} /> {t("exportTheme")}
            </button>
            <span className="settings__theme-glyph" aria-hidden="true">
              Aa
            </span>
            <Select
              className="settings__theme-select"
              value={theme.id}
              options={themes.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              onChange={(value) => setTheme(value, scheme)}
            />
          </div>
        </div>
        <div className="settings__appearance-row">
          <span>{t("appearanceAccent")}</span>
          <ColorField
            value={vars["--accent"]}
            label={t("appearanceAccent")}
            onChange={(value) => updateBaseColor(scheme, "accent", value)}
          />
        </div>
        <div className="settings__appearance-row">
          <span>{t("backgroundColor")}</span>
          <ColorField
            value={vars["--bg"]}
            label={t("backgroundColor")}
            onChange={(value) => updateBaseColor(scheme, "background", value)}
          />
        </div>
        <div className="settings__appearance-row">
          <span>{t("appearanceForeground")}</span>
          <ColorField
            value={vars["--fg"]}
            label={t("appearanceForeground")}
            onChange={(value) => updateBaseColor(scheme, "foreground", value)}
          />
        </div>
        <div className="settings__appearance-row">
          <span>{t("font")}</span>
          <Select value={general.font} options={UI_FONT_OPTIONS} onChange={(value) => updateGeneral("font", value)} />
        </div>
        <div className="settings__appearance-row">
          <span>{t("codeFont")}</span>
          <Select
            value={general.codeFont}
            options={MONO_FONT_OPTIONS}
            onChange={(value) => updateGeneral("codeFont", value)}
          />
        </div>
      </div>
    );
  };

  const visibleSchemes: ResolvedScheme[] =
    colorScheme === "system" ? [resolvedScheme, resolvedScheme === "dark" ? "light" : "dark"] : [colorScheme];

  return (
    <div className="settings__appearance">
      <section className="settings__appearance-section">
        <h3>{t("theme")}</h3>
        <div className="settings__theme-modes">
          <ModeCard
            mode="system"
            active={colorScheme === "system"}
            label={t("system")}
            lightVars={lightVars}
            darkVars={darkVars}
            onSelect={() => setColorScheme("system")}
          />
          <ModeCard
            mode="light"
            active={colorScheme === "light"}
            label={t("light")}
            lightVars={lightVars}
            darkVars={darkVars}
            onSelect={() => setColorScheme("light")}
          />
          <ModeCard
            mode="dark"
            active={colorScheme === "dark"}
            label={t("dark")}
            lightVars={lightVars}
            darkVars={darkVars}
            onSelect={() => setColorScheme("dark")}
          />
        </div>
        <DiffPreview lightVars={lightVars} darkVars={darkVars} />
        <div className="settings__appearance-editors" key={colorScheme}>
          {visibleSchemes.map(editor)}
        </div>
      </section>

      <section className="settings__appearance-section">
        <h3>{t("appearancePreferences")}</h3>
        <div className="settings__control-group">
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
            <Toggle
              checked={general.experimentalExtremeRadius}
              onValueChange={(checked) => {
                updateGeneral("experimentalExtremeRadius", checked);
                if (!checked && (parseFloat(general.radius) || 0) > 16) updateGeneral("radius", "16");
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
          <ControlRow label={t("blurOverlay")} description={t("blurOverlayDesc")}>
            <Select
              value={general.blur}
              options={[
                { value: "none", label: t("blurNone") },
                { value: "subtle", label: t("blurSubtle") },
                { value: "strong", label: t("blurStrong") },
              ]}
              onChange={(value) => updateGeneral("blur", value)}
            />
          </ControlRow>
        </div>
      </section>

      <section className="settings__appearance-section">
        <h3>{t("uiZoom")}</h3>
        <div className="settings__control-group">
          <ControlRow label={t("zoomStep")} description={t("zoomStepDesc")}>
            <NumberInput
              value={general.zoomStep}
              step={0.05}
              min={0.05}
              max={1}
              onChange={(value) => updateGeneral("zoomStep", value)}
            />
          </ControlRow>
          <ControlRow label={t("zoomDefault")} description={t("zoomDefaultDesc")}>
            <NumberInput
              value={general.zoomDefault}
              step={0.05}
              min={0.2}
              max={3}
              onChange={(value) => updateGeneral("zoomDefault", value)}
            />
          </ControlRow>
        </div>
      </section>

      <section className="settings__appearance-section">
        <h3>{t("animations")}</h3>
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
        <div className="settings__control-group settings__animation-speed">
          <ControlRow label={t("animMultiplier")} description={t("animMultiplierDesc")}>
            <NumberInput value={animMultiplier} step={0.1} min={0} max={5} onChange={setAnimMultiplier} />
          </ControlRow>
        </div>
      </section>
    </div>
  );
}
