import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { themes, applyThemeVars, getThemeById, type ThemeDef, type ThemeVars } from "../themes/themes.js";

type ColorScheme = "dark" | "light" | "system";

interface ThemeContextValue {
  currentTheme: ThemeDef;
  previewTheme: ThemeDef | null;
  colorScheme: ColorScheme;
  resolvedScheme: "dark" | "light";
  setTheme: (id: string) => void;
  setColorScheme: (scheme: ColorScheme) => void;
  preview: (id: string | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(scheme: ColorScheme): "dark" | "light" {
  if (scheme === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return scheme;
}

const THEME_KEY = "theme:id";
const SCHEME_KEY = "theme:colorScheme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [currentId, setCurrentId] = useState("default");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [colorScheme, setColorSchemeState] = useState<ColorScheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([window.vibe.state.get(THEME_KEY), window.vibe.state.get(SCHEME_KEY)])
      .then(([themeId, scheme]) => {
        if (themeId) setCurrentId(themeId);
        if (scheme === "dark" || scheme === "light" || scheme === "system") {
          setColorSchemeState(scheme as ColorScheme);
        }
      })
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (colorScheme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const theme = getThemeById(previewId ?? currentId) ?? themes[0]!;
      const vars = resolveScheme("system") === "dark" ? theme.darkVars : theme.lightVars;
      applyThemeVars(vars);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [colorScheme, currentId, previewId]);

  const currentTheme = getThemeById(currentId) ?? themes[0]!;
  const previewTheme = previewId ? (getThemeById(previewId) ?? null) : null;
  const activeTheme = previewTheme ?? currentTheme;

  const resolvedScheme = resolveScheme(colorScheme);
  const activeVars: ThemeVars = resolvedScheme === "dark" ? activeTheme.darkVars : activeTheme.lightVars;

  useEffect(() => {
    applyThemeVars(activeVars);
  }, [activeVars]);

  const setTheme = useCallback((id: string) => {
    setCurrentId(id);
    setPreviewId(null);
    window.vibe.state.set(THEME_KEY, id);
  }, []);

  const preview = useCallback((id: string | null) => {
    setPreviewId(id);
  }, []);

  const setColorScheme = useCallback((scheme: ColorScheme) => {
    setColorSchemeState(scheme);
    window.vibe.state.set(SCHEME_KEY, scheme);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ currentTheme, previewTheme, colorScheme, resolvedScheme, setTheme, setColorScheme, preview }}
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
