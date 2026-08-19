import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { appState } from "@/platform/storage/common/keyValueStore";
import { addCustomTheme, applyThemeVars, getThemeById, type ThemeDef, type ThemeVars, themes } from "./themeRegistry";

export type ColorScheme = "dark" | "light" | "system";
export type ResolvedScheme = "dark" | "light";
type ThemeOverrides = Partial<Record<ResolvedScheme, Partial<ThemeVars>>>;
type ThemeOverridesById = Record<string, ThemeOverrides>;

interface ThemeContextValue {
  currentTheme: ThemeDef;
  previewTheme: ThemeDef | null;
  colorScheme: ColorScheme;
  resolvedScheme: ResolvedScheme;
  setTheme: (id: string, scheme?: ResolvedScheme) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  preview: (id: string | null) => void;
  themeForScheme: (scheme: ResolvedScheme) => ThemeDef;
  themeVarsFor: (scheme: ResolvedScheme) => ThemeVars;
  updateThemeVars: (scheme: ResolvedScheme, vars: Partial<ThemeVars>) => void;
  resetThemeVars: (scheme: ResolvedScheme) => void;
  hasThemeOverrides: (scheme: ResolvedScheme) => boolean;
  installTheme: (theme: ThemeDef) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "theme:id";
const DARK_THEME_KEY = "theme:darkId";
const LIGHT_THEME_KEY = "theme:lightId";
const SCHEME_KEY = "theme:colorScheme";
const OVERRIDES_KEY = "theme:overrides";
const CUSTOM_THEMES_KEY = "theme:customThemes";
let themeTransitionTimer: ReturnType<typeof setTimeout> | undefined;

function applyThemeVarsAnimated(vars: ThemeVars): void {
  const root = document.documentElement;
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-transitioning");
    if (themeTransitionTimer) clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(() => root.classList.remove("theme-transitioning"), 220);
  }
  applyThemeVars(vars);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeIds, setThemeIds] = useState<Record<ResolvedScheme, string>>({ dark: "default", light: "default" });
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("dark");
  const [systemScheme, setSystemScheme] = useState<ResolvedScheme>(() =>
    window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark",
  );
  const [overrides, setOverrides] = useState<ThemeOverridesById>({});
  const [, setThemeRevision] = useState(0);

  useEffect(() => {
    Promise.all([
      appState.get(THEME_KEY),
      appState.get(DARK_THEME_KEY),
      appState.get(LIGHT_THEME_KEY),
      appState.get(SCHEME_KEY),
      appState.get(OVERRIDES_KEY),
      appState.get(CUSTOM_THEMES_KEY),
    ]).then(([legacyThemeId, darkThemeId, lightThemeId, scheme, savedOverrides, savedCustomThemes]) => {
      const customThemes = parseJson<ThemeDef[]>(savedCustomThemes, []);
      for (const theme of customThemes) addCustomTheme(theme);

      const fallbackId = legacyThemeId || "default";
      setThemeIds({ dark: darkThemeId || fallbackId, light: lightThemeId || fallbackId });
      setOverrides(parseJson<ThemeOverridesById>(savedOverrides, {}));
      if (scheme === "dark" || scheme === "light" || scheme === "system") {
        setColorSchemeState(scheme);
      }
    });
  }, []);

  const resolvedScheme = colorScheme === "system" ? systemScheme : colorScheme;

  const themeForScheme = useCallback(
    (scheme: ResolvedScheme) => getThemeById(themeIds[scheme]) ?? themes[0]!,
    [themeIds],
  );

  const themeVarsFor = useCallback(
    (scheme: ResolvedScheme): ThemeVars => {
      const theme = themeForScheme(scheme);
      const base = scheme === "dark" ? theme.darkVars : theme.lightVars;
      return { ...base, ...overrides[theme.id]?.[scheme] };
    },
    [overrides, themeForScheme],
  );

  const currentTheme = themeForScheme(resolvedScheme);
  const previewTheme = previewId ? (getThemeById(previewId) ?? null) : null;
  const activeVars = useMemo(() => {
    if (!previewTheme) return themeVarsFor(resolvedScheme);
    return resolvedScheme === "dark" ? previewTheme.darkVars : previewTheme.lightVars;
  }, [previewTheme, resolvedScheme, themeVarsFor]);

  useEffect(() => {
    applyThemeVars(activeVars);
  }, [activeVars]);

  useEffect(() => {
    if (colorScheme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const handleChange = (event: MediaQueryListEvent) => setSystemScheme(event.matches ? "light" : "dark");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [colorScheme]);

  const setTheme = useCallback(
    (id: string, scheme?: ResolvedScheme) => {
      if (scheme) {
        setThemeIds((previous) => ({ ...previous, [scheme]: id }));
        appState.set(scheme === "dark" ? DARK_THEME_KEY : LIGHT_THEME_KEY, id);
      } else {
        // Keep the original app-wide theme picker semantics. The Appearance tab
        // passes a scheme explicitly when the two variants should differ.
        setThemeIds({ dark: id, light: id });
        appState.set(DARK_THEME_KEY, id);
        appState.set(LIGHT_THEME_KEY, id);
      }

      // Apply synchronously as well as through the reactive effect below. This
      // keeps the whole window in lock-step with the selector even while a
      // persisted Tauri setting is still being written.
      if (!scheme || scheme === resolvedScheme) {
        const nextTheme = getThemeById(id) ?? themes[0]!;
        const nextVars = resolvedScheme === "dark" ? nextTheme.darkVars : nextTheme.lightVars;
        applyThemeVarsAnimated({ ...nextVars, ...overrides[nextTheme.id]?.[resolvedScheme] });
      }

      setPreviewId(null);
      appState.set(THEME_KEY, id);
    },
    [overrides, resolvedScheme],
  );

  const preview = useCallback((id: string | null) => {
    setPreviewId(id);
  }, []);

  const setColorScheme = useCallback(
    (scheme: ColorScheme) => {
      const nextResolved = scheme === "system" ? systemScheme : scheme;
      const nextTheme = themeForScheme(nextResolved);
      const nextBase = nextResolved === "dark" ? nextTheme.darkVars : nextTheme.lightVars;
      applyThemeVarsAnimated({ ...nextBase, ...overrides[nextTheme.id]?.[nextResolved] });
      setColorSchemeState(scheme);
      setPreviewId(null);
      appState.set(SCHEME_KEY, scheme);
    },
    [overrides, systemScheme, themeForScheme],
  );

  const updateThemeVars = useCallback(
    (scheme: ResolvedScheme, vars: Partial<ThemeVars>) => {
      const themeId = themeIds[scheme];
      setOverrides((previous) => {
        const next: ThemeOverridesById = {
          ...previous,
          [themeId]: {
            ...previous[themeId],
            [scheme]: { ...previous[themeId]?.[scheme], ...vars },
          },
        };
        if (scheme === resolvedScheme) {
          const theme = getThemeById(themeId) ?? themes[0]!;
          const base = scheme === "dark" ? theme.darkVars : theme.lightVars;
          applyThemeVars({ ...base, ...next[themeId]?.[scheme] });
        }
        appState.set(OVERRIDES_KEY, JSON.stringify(next));
        return next;
      });
    },
    [resolvedScheme, themeIds],
  );

  const resetThemeVars = useCallback(
    (scheme: ResolvedScheme) => {
      const themeId = themeIds[scheme];
      setOverrides((previous) => {
        const next = { ...previous };
        const themeOverrides = { ...next[themeId] };
        delete themeOverrides[scheme];
        if (Object.keys(themeOverrides).length === 0) delete next[themeId];
        else next[themeId] = themeOverrides;
        if (scheme === resolvedScheme) {
          const theme = getThemeById(themeId) ?? themes[0]!;
          applyThemeVars(scheme === "dark" ? theme.darkVars : theme.lightVars);
        }
        appState.set(OVERRIDES_KEY, JSON.stringify(next));
        return next;
      });
    },
    [resolvedScheme, themeIds],
  );

  const hasThemeOverrides = useCallback(
    (scheme: ResolvedScheme) => Object.keys(overrides[themeIds[scheme]]?.[scheme] ?? {}).length > 0,
    [overrides, themeIds],
  );

  const installTheme = useCallback((theme: ThemeDef) => {
    addCustomTheme(theme);
    const customThemes = themes.filter((candidate) => candidate.id.startsWith("custom-"));
    appState.set(CUSTOM_THEMES_KEY, JSON.stringify(customThemes));
    setThemeRevision((revision) => revision + 1);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        currentTheme,
        previewTheme,
        colorScheme,
        resolvedScheme,
        setTheme,
        setColorScheme,
        preview,
        themeForScheme,
        themeVarsFor,
        updateThemeVars,
        resetThemeVars,
        hasThemeOverrides,
        installTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
