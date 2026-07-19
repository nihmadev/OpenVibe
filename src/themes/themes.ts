import monokai from "./monokai.json";
import carbonfox from "./carbonfox.json";
import gruvbox from "./gruvbox.json";
import gruvboxMedium from "./gruvbox-medium.json";
import gruvboxSoft from "./gruvbox-soft.json";
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
  "--markdown-link": string;
  "--markdown-link-text": string;
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
  return (
    "#" +
    [r, g, b]
      .map((x) =>
        Math.max(0, Math.min(255, Math.round(x)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
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

function deriveVars(
  palette: Record<string, string>,
  overrides: Record<string, string> | undefined,
  isDark: boolean,
): ThemeVars {
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
    "--knob": ink,
    "--knob-bg": isDark ? adjust(neutral, 0.25) : adjust(neutral, 0.2),
    "--toggle-checked": ink,
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
    "--markdown-link": o["markdown-link"] || palette.interactive || primary,
    "--markdown-link-text": o["markdown-link-text"] || o["markdown-link"] || palette.interactive || primary,
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
  "--knob": "#e6e6e6",
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
  "--markdown-link": "#67e8f9",
  "--markdown-link-text": "#67e8f9",
};

const defaultLight: ThemeVars = {
  "--bg": "#f2f2f2",
  "--bg-2": "#ededed",
  "--bg-3": "#e8e8e8",
  "--line": "#e1e1e1",
  "--line-strong": "#d5d5d5",
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
  "--markdown-link": "#0284c7",
  "--markdown-link-text": "#0284c7",
};

export const themes: ThemeDef[] = [
  { id: "default", name: "Default", darkVars: defaultDark, lightVars: defaultLight },
  fromJson(monokai as ThemeJson),
  fromJson(carbonfox as ThemeJson),
  fromJson(gruvbox as ThemeJson),
  fromJson(gruvboxMedium as ThemeJson),
  fromJson(gruvboxSoft as ThemeJson),
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

export function parseVSCodeTheme(json: any): ThemeDef {
  const name = json.name || "Custom Theme";
  const id = "custom-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // Basic mapping of standard vs code colors to OpenVibe tokens
  const colors = json.colors || {};

  const bg = colors["editor.background"] || "#1e1e1e";
  const fg = colors["editor.foreground"] || "#d4d4d4";
  const line = colors["editorGroup.border"] || colors["sideBar.border"] || "#333333";
  const accent = colors["button.background"] || colors["focusBorder"] || "#007acc";

  const isLight = json.type === "light";

  const vars: ThemeVars = {
    "--bg": bg,
    "--bg-2": colors["sideBar.background"] || darken(bg, 0.05),
    "--bg-3": colors["list.hoverBackground"] || lighten(bg, 0.1),
    "--line": line,
    "--line-strong": colors["widget.shadow"] || darken(line, 0.2),
    "--fg": fg,
    "--fg-dim": colors["editorLineNumber.foreground"] || darken(fg, 0.3),
    "--fg-muted": colors["descriptionForeground"] || darken(fg, 0.5),
    "--accent": accent,
    "--cyan": colors["terminal.ansiCyan"] || "#29b8db",
    "--green": colors["terminal.ansiGreen"] || "#23d18b",
    "--yellow": colors["terminal.ansiYellow"] || "#f5f543",
    "--red": colors["terminal.ansiRed"] || "#f14c4c",
    "--avatar-bg": accent,
    "--white": "#ffffff",
    "--knob": fg,
    "--knob-bg": colors["scrollbarSlider.background"] || "#444444",
    "--toggle-checked": fg,
    "--primary": accent,

    // syntax defaults
    "--syntax-comment": colors["editorLineNumber.foreground"] || "#6a9955",
    "--syntax-keyword": accent,
    "--syntax-string": colors["terminal.ansiGreen"] || "#ce9178",
    "--syntax-primitive": colors["terminal.ansiCyan"] || "#569cd6",
    "--syntax-variable": fg,
    "--syntax-property": colors["terminal.ansiCyan"] || "#9cdcfe",
    "--syntax-type": colors["terminal.ansiYellow"] || "#4ec9b0",
    "--syntax-constant": colors["terminal.ansiCyan"] || "#4fc1ff",
    "--syntax-operator": fg,
    "--syntax-punctuation": colors["editorLineNumber.foreground"] || "#d4d4d4",
    "--syntax-object": colors["terminal.ansiRed"] || "#f48771",
    "--markdown-link": colors["textLink.activeForeground"] || colors["textLink.foreground"] || accent,
    "--markdown-link-text": colors["textLink.foreground"] || accent,
  };

  // Try to refine syntax tokens if tokenColors is present
  if (Array.isArray(json.tokenColors)) {
    for (const token of json.tokenColors) {
      if (!token.scope || !token.settings || !token.settings.foreground) continue;
      const scopes = Array.isArray(token.scope) ? token.scope : [token.scope];
      const color = token.settings.foreground;

      for (const scope of scopes) {
        if (scope.includes("comment")) vars["--syntax-comment"] = color;
        else if (scope.includes("keyword")) vars["--syntax-keyword"] = color;
        else if (scope.includes("string")) vars["--syntax-string"] = color;
        else if (scope.includes("constant.language")) vars["--syntax-primitive"] = color;
        else if (scope.includes("variable")) vars["--syntax-variable"] = color;
        else if (scope.includes("variable.other.property") || scope.includes("property"))
          vars["--syntax-property"] = color;
        else if (scope.includes("entity.name.type")) vars["--syntax-type"] = color;
        else if (scope.includes("constant")) vars["--syntax-constant"] = color;
        else if (scope.includes("keyword.operator")) vars["--syntax-operator"] = color;
        else if (scope.includes("punctuation")) vars["--syntax-punctuation"] = color;
      }
    }
  }

  // VS Code JSON doesn't separate light and dark strictly for both, but usually it's one theme.
  // We'll apply it to both lightVars and darkVars. In a real scenario, the user imports a specific light or dark theme.
  return {
    id,
    name,
    darkVars: vars,
    lightVars: vars,
  };
}

export function addCustomTheme(theme: ThemeDef) {
  if (!themes.find((t) => t.id === theme.id)) {
    themes.push(theme);
  }
}

export { hexWithAlpha, hexToArgb };
