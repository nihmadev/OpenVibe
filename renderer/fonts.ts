import "@fontsource/inter";
import "@fontsource/roboto";
import "@fontsource/open-sans";
import "@fontsource/nunito";
import "@fontsource/manrope";
import "@fontsource/poppins";
import "@fontsource/fira-code";
import "@fontsource/source-code-pro";
import "@fontsource/space-mono";
import "@fontsource/ibm-plex-mono";
import "@fontsource/anonymous-pro";

export interface FontOption {
  value: string;
  label: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Nunito", label: "Nunito" },
  { value: "Manrope", label: "Manrope" },
  { value: "Poppins", label: "Poppins" },
];

export const CODE_FONT_OPTIONS: FontOption[] = [
  { value: "JetBrains Mono", label: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code" },
  { value: "Source Code Pro", label: "Source Code Pro" },
  { value: "Space Mono", label: "Space Mono" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono" },
  { value: "Anonymous Pro", label: "Anonymous Pro" },
];

const FONT_FALLBACKS: Record<string, string> = {
  "Segoe UI": '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  "System": "Tahoma, Geneva, Verdana, sans-serif",
};

const MONO_FALLBACKS: Record<string, string> = {
  "Consolas": "Consolas, ui-monospace, SFMono-Regular, Menlo, monospace",
  "Cascadia Code": '"Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  "monospace": "monospace",
};

export function applyFont(font: string, codeFont: string): void {
  const fontStack = FONT_FALLBACKS[font] ?? `"${font}", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
  const monoStack = MONO_FALLBACKS[codeFont] ?? `"${codeFont}", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  document.documentElement.style.setProperty("--sans", fontStack);
  document.documentElement.style.setProperty("--mono", monoStack);
}

export async function initFonts(): Promise<void> {
  try {
    const vibe = (window as any).vibe;
    if (!vibe?.state) return;
    const [font, codeFont] = await Promise.all([
      vibe.state.get("settings:font"),
      vibe.state.get("settings:codeFont"),
    ]);
    applyFont(font || "Segoe UI", codeFont || "JetBrains Mono");
  } catch {
    // ignore
  }
}
