import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type AnimStyle = "smooth" | "snappy" | "none";

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
}

export type AnimKey = keyof AnimationSettings;

const DEFAULTS: AnimationSettings = {
  projectHover: "smooth",
  projectSwitch: "smooth",
  sidebarSlide: "smooth",
  contextMenu: "smooth",
  buttons: "smooth",
  panelAppear: "smooth",
};

// Duration tables per style
const DURATIONS: Record<AnimStyle, { fast: string; normal: string; slow: string }> = {
  smooth: { fast: "0.12s", normal: "0.22s", slow: "0.35s" },
  snappy: { fast: "0.06s", normal: "0.10s", slow: "0.15s" },
  none:   { fast: "0s",    normal: "0s",    slow: "0s"    },
};

const EASING: Record<AnimStyle, string> = {
  smooth: "cubic-bezier(0.2, 0, 0.2, 1)",
  snappy: "cubic-bezier(0.4, 0, 1, 1)",
  none:   "linear",
};

// CSS variable names we inject into :root
const CSS_VARS = {
  projectHover:  "--anim-project-hover",
  projectSwitch: "--anim-project-switch",
  sidebarSlide:  "--anim-sidebar-slide",
  contextMenu:   "--anim-context-menu",
  buttons:       "--anim-buttons",
  panelAppear:   "--anim-panel-appear",
} as const satisfies Record<AnimKey, string>;

function applyAnimVars(settings: AnimationSettings): void {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VARS) as [AnimKey, string][]) {
    const style = settings[key];
    const d = DURATIONS[style];
    const e = EASING[style];
    root.style.setProperty(`${cssVar}-fast`,   `${d.fast} ${e}`);
    root.style.setProperty(`${cssVar}-normal`,  `${d.normal} ${e}`);
    root.style.setProperty(`${cssVar}-slow`,    `${d.slow} ${e}`);
    root.style.setProperty(`${cssVar}-enabled`, style === "none" ? "0" : "1");
  }
}

// ── Context ────────────────────────────────────────────────────────────────────

interface AnimContextValue {
  settings: AnimationSettings;
  set: (key: AnimKey, value: AnimStyle) => void;
}

const AnimContext = createContext<AnimContextValue | null>(null);

const STORAGE_PREFIX = "settings:anim:";

export function AnimationProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AnimationSettings>({ ...DEFAULTS });

  // Load from persisted state on mount
  useEffect(() => {
    const keys = Object.keys(DEFAULTS) as AnimKey[];
    Promise.all(
      keys.map(async (k) => {
        const val = await window.vibe.state.get(STORAGE_PREFIX + k);
        return [k, val] as const;
      }),
    ).then((entries) => {
      setSettings((prev) => {
        const next = { ...prev };
        for (const [k, val] of entries) {
          if (val === "smooth" || val === "snappy" || val === "none") {
            next[k] = val;
          }
        }
        applyAnimVars(next);
        return next;
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

  return <AnimContext.Provider value={{ settings, set }}>{children}</AnimContext.Provider>;
}

export function useAnimations(): AnimContextValue {
  const ctx = useContext(AnimContext);
  if (!ctx) throw new Error("useAnimations must be inside AnimationProvider");
  return ctx;
}
