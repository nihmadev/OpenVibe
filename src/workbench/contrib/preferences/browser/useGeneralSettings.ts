import { useEffect, useState } from "react";
import { setZoomDefault, setZoomStep } from "@/platform/configuration/browser/zoomConfiguration";
import { appState } from "@/platform/storage/common/keyValueStore";
import { applyFont } from "@/platform/theme/fontService";
import { DEFAULT_GENERAL_SETTINGS, type GeneralSettings, type UpdateGeneral } from "../common/preferences";

const SETTINGS_PREFIX = "settings:";
const BLUR_VALUES: Record<string, string> = { none: "0px", subtle: "8px", strong: "20px" };

function applyAppearance(settings: GeneralSettings): void {
  const radius = parseFloat(settings.radius) || 6;
  document.documentElement.style.setProperty("--radius", `${radius}px`);
  document.documentElement.style.setProperty("--blur-amount", BLUR_VALUES[settings.blur] ?? "0px");
  document.documentElement.classList.toggle("theme-borderless", settings.borderStyle === "borderless");
  document.documentElement.classList.toggle("theme-tab-pills", settings.tabStyle === "pills");
}

export function useGeneralSettings(onLanguageChange?: (lang: string) => void): {
  general: GeneralSettings;
  updateGeneral: UpdateGeneral;
} {
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

  const updateGeneral: UpdateGeneral = (key, value) => {
    setGeneral((previous) => {
      const next = { ...previous, [key]: value } as GeneralSettings;
      if (key === "font" || key === "codeFont") applyFont(next.font, next.codeFont);
      return next;
    });
    appState.set(SETTINGS_PREFIX + key, String(value));

    if (key === "promptMarkdown") localStorage.setItem("openvibe_prompt_markdown", String(value));
    if (key === "promptMarkdownGhost") localStorage.setItem("openvibe_prompt_markdown_ghost", String(value));
    window.dispatchEvent(new CustomEvent("settings-changed", { detail: { key, value } }));
    window.dispatchEvent(new CustomEvent("vibe:settings-changed", { detail: { key, value } }));

    if (key === "language") onLanguageChange?.(value as string);
    if (key === "zoomStep") setZoomStep(parseFloat(value as string) || 0.2);
    if (key === "zoomDefault") setZoomDefault(parseFloat(value as string) || 1.2);
    if (key === "radius") {
      document.documentElement.style.setProperty("--radius", `${parseFloat(value as string) || 6}px`);
    }
    if (key === "blur") {
      document.documentElement.style.setProperty("--blur-amount", BLUR_VALUES[value as string] ?? "0px");
    }
    if (key === "borderStyle") document.documentElement.classList.toggle("theme-borderless", value === "borderless");
    if (key === "tabStyle") document.documentElement.classList.toggle("theme-tab-pills", value === "pills");
  };

  return { general, updateGeneral };
}
