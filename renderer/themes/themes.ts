import monokai from "./monokai.json";
import carbonfox from "./carbonfox.json";
import gruvbox from "./gruvbox.json";
import cursor from "./cursor.json";
import oneDark from "./one-dark.json";
import everforest from "./everforest.json";
import flexoki from "./flexoki.json";
import vercel from "./vercel.json";
import vesper from "./vesper.json";
import zenburn from "./zenburn.json";
import github from "./github.json";
import kanagawa from "./kanagawa.json";
import ayu from "./Ayu.json";
import nord from "./nord.json";

interface ThemeJson {
  $schema?: string;
  name: string;
  id: string;
  light: { palette: Record<string, string>; overrides?: Record<string, string> };
  dark: { palette: Record<string, string>; overrides?: Record<string, string> };
}

export interface ThemeVars {
  "--bg": string;
  "--bg-2": string;
  "--bg-3": string;
  "--line": string;
  "--line-strong": string;
  "--fg": string;
  "--fg-dim": string;
  "--fg-muted": string;
  "--accent": string;
  "--cyan": string;
  "--green": string;
  "--yellow": string;
  "--red": string;
  "--avatar-bg": string;
  "--white": string;
  "--knob": string;
  "--knob-bg": string;
  "--toggle-checked": string;
  "--primary": string;
  "--syntax-comment": string;
  "--syntax-keyword": string;
  "--syntax-string": string;
  "--syntax-primitive": string;
  "--syntax-variable": string;
  "--syntax-property": string;
  "--syntax-type": string;
  "--syntax-constant": string;
  "--syntax-operator": string;
  "--syntax-punctuation": string;
  "--syntax-object": string;
}

export interface ThemeDef {
  id: string;
  name: string;
  darkVars: ThemeVars;
  lightVars: ThemeVars;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "");
  return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function hexWithAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToArgb(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return "#" + [r, g, b, a].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function deriveVars(palette: Record<string, string>, overrides: Record<string, string> | undefined, isDark: boolean): ThemeVars {
  const neutral = palette.neutral || "#161616";
  const ink = palette.ink || "#e6e6e6";
  const adjust = isDark ? lighten : darken;

  const textWeak = overrides?.["text-weak"];
  const o = overrides || {};
  const accent = palette.accent || "#888";
  const success = palette.success || "#86efac";
  const warning = palette.warning || "#fbbf24";
  const error = palette.error || "#f87171";
  const info = palette.info || "#67e8f9";
  const primary = palette.primary || accent;

  return {
    "--bg": neutral,
    "--bg-2": adjust(neutral, 0.02),
    "--bg-3": adjust(neutral, 0.04),
    "--line": adjust(neutral, 0.07),
    "--line-strong": adjust(neutral, 0.12),
    "--fg": ink,
    "--fg-dim": textWeak || hexWithAlpha(ink, 0.6),
    "--fg-muted": hexWithAlpha(ink, 0.3),
    "--accent": accent,
    "--cyan": info,
    "--green": success,
    "--yellow": warning,
    "--red": error,
    "--avatar-bg": primary,
    "--white": "#ffffff",
    "--knob": isDark ? "#ffffff" : "#1a1a1a",
    "--knob-bg": isDark ? "#555555" : "#aaaaaa",
    "--toggle-checked": isDark ? "#999999" : "#666666",
    "--primary": palette.primary || accent,
    "--syntax-comment": o["syntax-comment"] || (isDark ? "#888888" : "#888888"),
    "--syntax-keyword": o["syntax-keyword"] || accent,
    "--syntax-string": o["syntax-string"] || success,
    "--syntax-primitive": o["syntax-primitive"] || primary,
    "--syntax-variable": o["syntax-variable"] || ink,
    "--syntax-property": o["syntax-property"] || info,
    "--syntax-type": o["syntax-type"] || warning,
    "--syntax-constant": o["syntax-constant"] || warning,
    "--syntax-operator": o["syntax-operator"] || accent,
    "--syntax-punctuation": o["syntax-punctuation"] || ink,
    "--syntax-object": o["syntax-object"] || error,
  };
}

function fromJson(j: ThemeJson): ThemeDef {
  return {
    id: j.id,
    name: j.name,
    darkVars: deriveVars(j.dark.palette, j.dark.overrides, true),
    lightVars: deriveVars(j.light.palette, j.light.overrides, false),
  };
}

const defaultDark: ThemeVars = {
  "--bg": "#161616",
  "--bg-2": "#1c1c1c",
  "--bg-3": "#222222",
  "--line": "#2a2a2a",
  "--line-strong": "#3a3a3a",
  "--fg": "#e6e6e6",
  "--fg-dim": "rgba(230,230,230,0.6)",
  "--fg-muted": "rgba(230,230,230,0.3)",
  "--accent": "#e3e2e2",
  "--cyan": "#67e8f9",
  "--green": "#86efac",
  "--yellow": "#fbbf24",
  "--red": "#f87171",
  "--avatar-bg": "#7c6af7",
  "--white": "#ffffff",
  "--knob": "#ffffff",
  "--knob-bg": "#555555",
  "--toggle-checked": "#999999",
  "--primary": "#7c6af7",
  "--syntax-comment": "#888888",
  "--syntax-keyword": "#e3e2e2",
  "--syntax-string": "#86efac",
  "--syntax-primitive": "#7c6af7",
  "--syntax-variable": "#e6e6e6",
  "--syntax-property": "#67e8f9",
  "--syntax-type": "#fbbf24",
  "--syntax-constant": "#fbbf24",
  "--syntax-operator": "#e3e2e2",
  "--syntax-punctuation": "#e6e6e6",
  "--syntax-object": "#f87171",
};

const defaultLight: ThemeVars = {
  "--bg": "#ffffff",
  "--bg-2": "#f5f5f5",
  "--bg-3": "#ebebeb",
  "--line": "#d9d9d9",
  "--line-strong": "#bfbfbf",
  "--fg": "#1a1a1a",
  "--fg-dim": "rgba(26,26,26,0.6)",
  "--fg-muted": "rgba(26,26,26,0.3)",
  "--accent": "#7c6af7",
  "--cyan": "#0284c7",
  "--green": "#16a34a",
  "--yellow": "#ca8a04",
  "--red": "#dc2626",
  "--avatar-bg": "#7c6af7",
  "--white": "#ffffff",
  "--knob": "#1a1a1a",
  "--knob-bg": "#aaaaaa",
  "--toggle-checked": "#666666",
  "--primary": "#7c6af7",
  "--syntax-comment": "#888888",
  "--syntax-keyword": "#7c6af7",
  "--syntax-string": "#16a34a",
  "--syntax-primitive": "#7c6af7",
  "--syntax-variable": "#1a1a1a",
  "--syntax-property": "#0284c7",
  "--syntax-type": "#ca8a04",
  "--syntax-constant": "#ca8a04",
  "--syntax-operator": "#7c6af7",
  "--syntax-punctuation": "#1a1a1a",
  "--syntax-object": "#dc2626",
};

export const themes: ThemeDef[] = [
  { id: "default", name: "Default", darkVars: defaultDark, lightVars: defaultLight },
  fromJson(monokai as ThemeJson),
  fromJson(carbonfox as ThemeJson),
  fromJson(gruvbox as ThemeJson),
  fromJson(ayu as ThemeJson),
  fromJson(cursor as ThemeJson),
  fromJson(oneDark as ThemeJson),
  fromJson(everforest as ThemeJson),
  fromJson(flexoki as ThemeJson),
  fromJson(vercel as ThemeJson),
  fromJson(vesper as ThemeJson),
  fromJson(zenburn as ThemeJson),
  fromJson(github as ThemeJson),
  fromJson(kanagawa as ThemeJson),
  fromJson(nord as ThemeJson),
];

export function applyThemeVars(vars: ThemeVars): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function getThemeById(id: string): ThemeDef | undefined {
  return themes.find((t) => t.id === id);
}

export { hexWithAlpha, hexToArgb };
