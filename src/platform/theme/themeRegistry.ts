import amoled from "./amoled.json";
import aura from "./aura.json";
import ayu from "./ayu.json";
import carbonfox from "./carbonfox.json";
import catppuccin from "./catppuccin.json";
import catppuccinFrappe from "./catppuccinFrappe.json";
import catppuccinMacchiato from "./catppuccinMacchiato.json";
import cobalt2 from "./cobalt2.json";
import cursor from "./cursor.json";
import defaultTheme from "./default.json";
import dracula from "./dracula.json";
import everforest from "./everforest.json";
import flexoki from "./flexoki.json";
import github from "./github.json";
import gruvbox from "./gruvbox.json";
import gruvboxMedium from "./gruvboxMedium.json";
import gruvboxSoft from "./gruvboxSoft.json";
import kanagawa from "./kanagawa.json";
import lucentOrng from "./lucentOrng.json";
import material from "./material.json";
import matrix from "./matrix.json";
import mercury from "./mercury.json";
import monokai from "./monokai.json";
import nightowl from "./nightowl.json";
import nord from "./nord.json";
import oneDark from "./oneDark.json";
import onedarkpro from "./onedarkpro.json";
import opencode from "./opencode.json";
import orng from "./orng.json";
import osakaJade from "./osakaJade.json";
import palenight from "./palenight.json";
import rosepine from "./rosepine.json";
import shadesofpurple from "./shadesofpurple.json";
import solarized from "./solarized.json";
import synthwave84 from "./synthwave84.json";
import tokyonight from "./tokyonight.json";
import vercel from "./vercel.json";
import vesper from "./vesper.json";
import zenburn from "./zenburn.json";

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
  "--surface-underlay": string;
  "--line": string;
  "--line-strong": string;
  "--fg": string;
  "--fg-dim": string;
  "--fg-muted": string;
  "--accent": string;
  "--accent-text": string;
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
  return `#${[r, g, b, a].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function deriveVars(
  palette: Record<string, string>,
  overrides: Record<string, string> | undefined,
  isDark: boolean,
): ThemeVars {
  const neutral = palette.neutral || "#161616";
  const ink = palette.ink || "#e6e6e6";
  const adjust = isDark ? lighten : darken;

  const o = overrides || {};
  const textStrong = o["text-strong"];
  const textBase = o["text-base"];
  const textWeak = o["text-weak"];
  const surfaceBase = o["surface-base"];
  const surfaceRaised = o["surface-raised-base"];
  const borderWeak = o["border-weak-base"];
  const borderWeaker = o["border-weaker-base"];
  // Theme palettes originate from editor themes, where `ink`, `accent`, and
  // `primary` are often deliberately saturated syntax colors. They must not
  // leak into application chrome: icons, labels, focus rings and toggles use a
  // calm neutral UI palette. Themes can still opt in to bespoke UI colors via
  // overrides, while their original palette remains available to syntax and
  // semantic content below.
  const foreground = textStrong || (isDark ? "#e6e6e6" : "#171717");
  const accent = o["ui-accent"] || (isDark ? "#888888" : "#666666");
  const accentText = o["ui-accent-text"] || (isDark ? "#111111" : "#ffffff");
  const syntaxAccent = palette.accent || palette.primary || "#888888";
  const success = palette.success || "#86efac";
  const warning = palette.warning || "#fbbf24";
  const error = palette.error || "#f87171";
  const info = palette.info || "#67e8f9";
  const primary = palette.primary || accent;

  return {
    "--bg": neutral,
    "--bg-2": surfaceBase || adjust(neutral, 0.02),
    "--bg-3": surfaceRaised || adjust(neutral, 0.04),
    "--surface-underlay": isDark ? darken(neutral, 0.25) : darken(neutral, 0.02),
    "--line": borderWeaker || adjust(neutral, 0.07),
    "--line-strong": borderWeak || adjust(neutral, 0.12),
    "--fg": foreground,
    "--fg-dim": textBase || textWeak || hexWithAlpha(foreground, 0.72),
    "--fg-muted": textWeak || hexWithAlpha(foreground, 0.52),
    "--accent": accent,
    "--accent-text": accentText,
    "--cyan": info,
    "--green": success,
    "--yellow": warning,
    "--red": error,
    "--avatar-bg": primary,
    "--white": "#ffffff",
    "--knob": foreground,
    "--knob-bg": isDark ? adjust(neutral, 0.25) : adjust(neutral, 0.2),
    "--toggle-checked": accent,
    "--primary": accent,
    "--syntax-comment": o["syntax-comment"] || (isDark ? "#888888" : "#888888"),
    "--syntax-keyword": o["syntax-keyword"] || syntaxAccent,
    "--syntax-string": o["syntax-string"] || success,
    "--syntax-primitive": o["syntax-primitive"] || primary,
    "--syntax-variable": o["syntax-variable"] || ink,
    "--syntax-property": o["syntax-property"] || info,
    "--syntax-type": o["syntax-type"] || warning,
    "--syntax-constant": o["syntax-constant"] || warning,
    "--syntax-operator": o["syntax-operator"] || syntaxAccent,
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

export const themes: ThemeDef[] = [
  fromJson(defaultTheme as ThemeJson),
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
  fromJson(amoled as ThemeJson),
  fromJson(aura as ThemeJson),
  fromJson(catppuccin as ThemeJson),
  fromJson(catppuccinFrappe as ThemeJson),
  fromJson(catppuccinMacchiato as ThemeJson),
  fromJson(cobalt2 as ThemeJson),
  fromJson(dracula as ThemeJson),
  fromJson(lucentOrng as ThemeJson),
  fromJson(material as ThemeJson),
  fromJson(matrix as ThemeJson),
  fromJson(mercury as ThemeJson),
  fromJson(nightowl as ThemeJson),
  fromJson(onedarkpro as ThemeJson),
  fromJson(opencode as ThemeJson),
  fromJson(orng as ThemeJson),
  fromJson(osakaJade as ThemeJson),
  fromJson(palenight as ThemeJson),
  fromJson(rosepine as ThemeJson),
  fromJson(shadesofpurple as ThemeJson),
  fromJson(solarized as ThemeJson),
  fromJson(synthwave84 as ThemeJson),
  fromJson(tokyonight as ThemeJson),
];

export function applyThemeVars(vars: ThemeVars): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    if (key === "--line" || key === "--line-strong") {
      root.style.setProperty(key === "--line" ? "--theme-line" : "--theme-line-strong", value);
      root.style.setProperty(key, root.classList.contains("theme-borderless") ? "transparent" : value);
    } else {
      root.style.setProperty(key, value);
    }
  }
}

export function getThemeById(id: string): ThemeDef | undefined {
  return themes.find((t) => t.id === id);
}

export function parseVSCodeTheme(json: any): ThemeDef {
  const name = json.name || "Custom Theme";
  const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // Basic mapping of standard vs code colors to OpenVibe tokens
  const colors = json.colors || {};

  const bg = colors["editor.background"] || "#1e1e1e";
  const fg = colors["editor.foreground"] || "#d4d4d4";
  const line = colors["editorGroup.border"] || colors["sideBar.border"] || "#333333";
  const syntaxAccent = colors["button.background"] || colors.focusBorder || "#007acc";

  const _isLight = json.type === "light";

  const uiForeground = _isLight ? "#171717" : "#e6e6e6";
  const uiAccent = _isLight ? "#666666" : "#888888";

  const vars: ThemeVars = {
    "--bg": bg,
    "--bg-2": colors["sideBar.background"] || darken(bg, 0.05),
    "--bg-3": colors["list.hoverBackground"] || lighten(bg, 0.1),
    "--surface-underlay":
      colors["titleBar.activeBackground"] || colors["activityBar.background"] || darken(bg, _isLight ? 0.02 : 0.25),
    "--line": line,
    "--line-strong": colors["widget.shadow"] || darken(line, 0.2),
    "--fg": uiForeground,
    "--fg-dim": hexWithAlpha(uiForeground, 0.72),
    "--fg-muted": hexWithAlpha(uiForeground, 0.52),
    "--accent": uiAccent,
    "--accent-text": _isLight ? "#ffffff" : "#111111",
    "--cyan": colors["terminal.ansiCyan"] || "#29b8db",
    "--green": colors["terminal.ansiGreen"] || "#23d18b",
    "--yellow": colors["terminal.ansiYellow"] || "#f5f543",
    "--red": colors["terminal.ansiRed"] || "#f14c4c",
    "--avatar-bg": syntaxAccent,
    "--white": "#ffffff",
    "--knob": uiForeground,
    "--knob-bg": colors["scrollbarSlider.background"] || "#444444",
    "--toggle-checked": uiAccent,
    "--primary": uiAccent,

    // syntax defaults
    "--syntax-comment": colors["editorLineNumber.foreground"] || "#6a9955",
    "--syntax-keyword": syntaxAccent,
    "--syntax-string": colors["terminal.ansiGreen"] || "#ce9178",
    "--syntax-primitive": colors["terminal.ansiCyan"] || "#569cd6",
    "--syntax-variable": fg,
    "--syntax-property": colors["terminal.ansiCyan"] || "#9cdcfe",
    "--syntax-type": colors["terminal.ansiYellow"] || "#4ec9b0",
    "--syntax-constant": colors["terminal.ansiCyan"] || "#4fc1ff",
    "--syntax-operator": fg,
    "--syntax-punctuation": colors["editorLineNumber.foreground"] || "#d4d4d4",
    "--syntax-object": colors["terminal.ansiRed"] || "#f48771",
    "--markdown-link": colors["textLink.activeForeground"] || colors["textLink.foreground"] || syntaxAccent,
    "--markdown-link-text": colors["textLink.foreground"] || syntaxAccent,
  };

  // Try to refine syntax tokens if tokenColors is present
  if (Array.isArray(json.tokenColors)) {
    for (const token of json.tokenColors) {
      if (!token.scope || !token.settings?.foreground) continue;
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

export { hexToArgb, hexWithAlpha };
