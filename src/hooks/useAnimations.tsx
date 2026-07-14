import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Visual animation style for a given UI slot */
export type AnimStyle = "fade" | "slide" | "scale" | "fade-slide" | "none";

export interface AnimationSettings {
  /** Project tile hover animation */
  projectHover: AnimStyle;
  /** Switching active project (main content fade/slide) */
  projectSwitch: AnimStyle;
  /** Sidebar / session list open/close slide */
  sidebarSlide: AnimStyle;
  /** Context menu appearance */
  contextMenu: AnimStyle;
  /** Buttons and interactive elements */
  buttons: AnimStyle;
  /** Panels & modals appearing */
  panelAppear: AnimStyle;
  /** Global animation smoothness multiplier (0 = stopped, 0.5 = snappy, 1 = normal, 2 = smooth, 5 = ultra smooth) */
  animMultiplier: string;
}

export type AnimKey = keyof AnimationSettings;

const ANIM_STYLE_KEYS: (keyof AnimationSettings)[] = [
  "projectHover",
  "projectSwitch",
  "sidebarSlide",
  "contextMenu",
  "buttons",
  "panelAppear",
];

const DEFAULTS: AnimationSettings = {
  projectHover: "fade-slide",
  projectSwitch: "fade-slide",
  sidebarSlide: "slide",
  contextMenu: "fade-slide",
  buttons: "fade",
  panelAppear: "fade-slide",
  animMultiplier: "1",
};

// Duration tables per style (fast/normal/slow)
const DURATIONS: Record<AnimStyle, { fast: string; normal: string; slow: string }> = {
  fade: { fast: "0.10s", normal: "0.18s", slow: "0.30s" },
  slide: { fast: "0.12s", normal: "0.22s", slow: "0.36s" },
  scale: { fast: "0.10s", normal: "0.18s", slow: "0.28s" },
  "fade-slide": { fast: "0.12s", normal: "0.22s", slow: "0.35s" },
  none: { fast: "0s", normal: "0s", slow: "0s" },
};

const EASING: Record<AnimStyle, string> = {
  fade: "ease",
  slide: "cubic-bezier(0.2, 0, 0.2, 1)",
  scale: "cubic-bezier(0.34, 1, 0.64, 1)",
  "fade-slide": "cubic-bezier(0.2, 0, 0.2, 1)",
  none: "linear",
};

// Keyframe names per style (used by CSS animations)
export const ANIM_KEYFRAMES: Record<AnimStyle, string> = {
  fade: "anim-fade",
  slide: "anim-slide",
  scale: "anim-scale",
  "fade-slide": "anim-fade-slide",
  none: "none",
};

// CSS variable names we inject into :root
const CSS_VARS = {
  projectHover: "--anim-project-hover",
  projectSwitch: "--anim-project-switch",
  sidebarSlide: "--anim-sidebar-slide",
  contextMenu: "--anim-context-menu",
  buttons: "--anim-buttons",
  panelAppear: "--anim-panel-appear",
} as const;

export function applyAnimVars(settings: AnimationSettings): void {
  const root = document.documentElement;
  const mult = parseFloat(settings.animMultiplier) || 1;
  for (const key of ANIM_STYLE_KEYS) {
    if (!(key in CSS_VARS)) continue;
    const cssVar = CSS_VARS[key as keyof typeof CSS_VARS];
    const style = settings[key as keyof typeof settings] as AnimStyle;
    const d = DURATIONS[style];
    const e = EASING[style];
    const kf = ANIM_KEYFRAMES[style];
    function scaleDuration(orig: string): string {
      if (mult === 0) return "0s";
      if (mult === 1) return orig;
      const sec = parseFloat(orig) * mult;
      return `${sec.toFixed(3)}s`;
    }
    root.style.setProperty(`${cssVar}-fast`, `${scaleDuration(d.fast)} ${e}`);
    root.style.setProperty(`${cssVar}-normal`, `${scaleDuration(d.normal)} ${e}`);
    root.style.setProperty(`${cssVar}-slow`, `${scaleDuration(d.slow)} ${e}`);
    root.style.setProperty(`${cssVar}-enabled`, style === "none" ? "0" : "1");
    root.style.setProperty(`${cssVar}-keyframes`, kf);
    root.style.setProperty(`${cssVar}-easing`, e);
    root.style.setProperty(`${cssVar}-duration`, scaleDuration(d.normal));
  }
  const cssSafeMult = Math.max(mult, 0.01);
  root.style.setProperty("--anim-multiplier", cssSafeMult.toString());
}

// ── Context ────────────────────────────────────────────────────────────────────

interface AnimContextValue {
  settings: AnimationSettings;
  set: (key: AnimKey, value: AnimStyle) => void;
  animMultiplier: string;
  setAnimMultiplier: (value: string) => void;
}

const AnimContext = createContext<AnimContextValue | null>(null);

const STORAGE_PREFIX = "settings:anim:";

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AnimationSettings>({ ...DEFAULTS });

  const VALID_STYLES = new Set<AnimStyle>(["fade", "slide", "scale", "fade-slide", "none"]);

  // Load from persisted state on mount
  useEffect(() => {
    const keys = ANIM_STYLE_KEYS as AnimKey[];
    Promise.all(
      keys.map(async (k) => {
        const val = await window.vibe.state.get(STORAGE_PREFIX + k);
        return [k, val] as const;
      }),
    ).then((entries) => {
      window.vibe.state.get(STORAGE_PREFIX + "animMultiplier").then((mult) => {
        setSettings((prev) => {
          const next = { ...prev };
          for (const [k, val] of entries) {
            if (val && VALID_STYLES.has(val as AnimStyle)) {
              next[k] = val as AnimStyle;
            }
          }
          if (mult) {
            const parsed = parseFloat(mult as string);
            if (!isNaN(parsed) && parsed >= 0) {
              next.animMultiplier = parsed.toString();
            }
          }
          applyAnimVars(next);
          return next;
        });
      });
    });
  }, []);

  const set = useCallback((key: AnimKey, value: AnimStyle) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      applyAnimVars(next);
      return next;
    });
    window.vibe.state.set(STORAGE_PREFIX + key, value);
  }, []);

  const setAnimMultiplier = useCallback((value: string) => {
    setSettings((prev) => {
      const next = { ...prev, animMultiplier: value };
      applyAnimVars(next);
      return next;
    });
    window.vibe.state.set(STORAGE_PREFIX + "animMultiplier", value);
  }, []);

  return (
    <AnimContext.Provider
      value={{
        settings,
        set,
        animMultiplier: settings.animMultiplier,
        setAnimMultiplier,
      }}
    >
      {children}
    </AnimContext.Provider>
  );
}

export function useAnimations(): AnimContextValue {
  const ctx = useContext(AnimContext);
  if (!ctx) throw new Error("useAnimations must be inside AnimationProvider");
  return ctx;
}
