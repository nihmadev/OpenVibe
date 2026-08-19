import type React from "react";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setZoomDefault, setZoomStep } from "@/platform/configuration/browser/zoomConfiguration";
import { appState } from "@/platform/storage/common/keyValueStore";
import { applyFont } from "@/platform/theme/fontService";
import { DEFAULT_GENERAL_SETTINGS, type GeneralSettings, type UpdateGeneral } from "../common/preferences";

const SETTINGS_PREFIX = "settings:";
const BLUR_VALUES: Record<string, string> = { none: "0px", subtle: "8px", strong: "20px" };
const SEMANTIC_BORDER_TOKENS = [
  "--surface-border",
  "--surface-border-soft",
  "--workspace-panel-border",
  "--workspace-panel-border-heavy",
  "--workspace-panel-border-light",
];

export function applyAppearance(settings: GeneralSettings): void {
  const parsedRadius = Number.parseFloat(settings.radius);
  const radius = Number.isFinite(parsedRadius) ? Math.max(0, parsedRadius) : Number(DEFAULT_GENERAL_SETTINGS.radius);
  const root = document.documentElement;
  const radiusScale = {
    "--radius": radius,
    "--radius-xs": radius * 0.5,
    "--radius-sm": radius * 0.75,
    "--radius-md": radius,
    "--radius-lg": radius * 1.25,
    "--radius-xl": radius * 1.5,
    "--radius-2xl": radius * 1.75,
  };
  for (const [token, value] of Object.entries(radiusScale)) root.style.setProperty(token, `${value}px`);
  root.style.setProperty("--blur-amount", BLUR_VALUES[settings.blur] ?? "0px");
  const borderless = settings.borderStyle === "borderless";
  root.classList.toggle("theme-borderless", borderless);
  if (borderless) {
    root.style.setProperty("--line", "transparent");
    root.style.setProperty("--line-strong", "transparent");
    for (const token of SEMANTIC_BORDER_TOKENS) root.style.setProperty(token, "transparent");
  } else {
    const themeLine = root.style.getPropertyValue("--theme-line");
    const themeLineStrong = root.style.getPropertyValue("--theme-line-strong");
    if (themeLine) root.style.setProperty("--line", themeLine);
    else root.style.removeProperty("--line");
    if (themeLineStrong) root.style.setProperty("--line-strong", themeLineStrong);
    else root.style.removeProperty("--line-strong");
    for (const token of SEMANTIC_BORDER_TOKENS) root.style.removeProperty(token);
  }
  root.classList.toggle("theme-tab-pills", settings.tabStyle === "pills");
}

interface GeneralSettingsContextValue {
  general: GeneralSettings;
  updateGeneral: UpdateGeneral;
}

const GeneralSettingsContext = createContext<GeneralSettingsContextValue | null>(null);

/**
 * Owns application-wide settings that affect CSS and editor consumers.
 * This deliberately lives with the other root providers instead of inside the
 * preferences dialog so saved appearance is active even when settings are closed.
 */
export function GeneralSettingsProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [general, setGeneral] = useState<GeneralSettings>({ ...DEFAULT_GENERAL_SETTINGS });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const keys = Object.keys(DEFAULT_GENERAL_SETTINGS) as (keyof GeneralSettings)[];
    Promise.all(keys.map(async (key) => [key, await appState.get(SETTINGS_PREFIX + key)] as const)).then((entries) => {
      setGeneral((previous) => {
        const next = { ...previous };
        for (const [key, value] of entries) {
          if (value === null) continue;
          const defaultValue = DEFAULT_GENERAL_SETTINGS[key];
          (next as any)[key] = typeof defaultValue === "boolean" ? value === "true" : value;
        }
        return next;
      });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) applyAppearance(general);
  }, [general, loaded]);

  useEffect(() => {
    const handleExternalChange = (event: Event) => {
      const detail = (event as CustomEvent<{ key?: keyof GeneralSettings; value?: string | boolean }>).detail;
      if (!detail?.key || !(detail.key in DEFAULT_GENERAL_SETTINGS)) return;
      setGeneral((previous) => ({ ...previous, [detail.key!]: detail.value }) as GeneralSettings);
    };
    window.addEventListener("vibe:settings-changed", handleExternalChange);
    return () => window.removeEventListener("vibe:settings-changed", handleExternalChange);
  }, []);

  const updateGeneral = useCallback<UpdateGeneral>((key, value) => {
    setGeneral((previous) => {
      const next = { ...previous, [key]: value } as GeneralSettings;
      if (key === "font" || key === "codeFont") void applyFont(next.font, next.codeFont);
      return next;
    });
    appState.set(SETTINGS_PREFIX + key, String(value));

    if (key === "promptMarkdown") localStorage.setItem("openvibe_prompt_markdown", String(value));
    if (key === "promptMarkdownGhost") localStorage.setItem("openvibe_prompt_markdown_ghost", String(value));
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: { key, value } }));
    window.dispatchEvent(new CustomEvent("vibe:settings-changed", { detail: { key, value } }));

    if (key === "zoomStep") setZoomStep(parseFloat(value as string) || 0.2);
    if (key === "zoomDefault") setZoomDefault(parseFloat(value as string) || 1.2);
  }, []);

  const value = useMemo(() => ({ general, updateGeneral }), [general, updateGeneral]);
  return createElement(GeneralSettingsContext.Provider, { value }, children);
}

export function useGeneralSettings(onLanguageChange?: (lang: string) => void): GeneralSettingsContextValue {
  const context = useContext(GeneralSettingsContext);
  if (!context) throw new Error("useGeneralSettings must be used within GeneralSettingsProvider");

  const updateGeneral = useCallback<UpdateGeneral>(
    (key, value) => {
      context.updateGeneral(key, value);
      if (key === "language") onLanguageChange?.(value as string);
    },
    [context.updateGeneral, onLanguageChange],
  );

  return useMemo(() => ({ general: context.general, updateGeneral }), [context.general, updateGeneral]);
}
