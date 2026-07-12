import "@fontsource/inter";
import "@fontsource/roboto";
import "@fontsource/open-sans";
import "@fontsource/nunito";
import "@fontsource/manrope";
import "@fontsource/poppins";
import "@fontsource/lato";
import "@fontsource/montserrat";
import "@fontsource/raleway";
import "@fontsource/ubuntu";
import "@fontsource/noto-sans";
import "@fontsource/source-sans-3";
import "@fontsource/pt-sans";
import "@fontsource/fira-sans";
import "@fontsource/barlow";
import "@fontsource/josefin-sans";
import "@fontsource/work-sans";
import "@fontsource/dm-sans";
import "@fontsource/plus-jakarta-sans";
import "@fontsource/figtree";
import "@fontsource/outfit";
import "@fontsource/sora";
import "@fontsource/lexend";
import "@fontsource/quicksand";
import "@fontsource/rubik";
import "@fontsource/mulish";
import "@fontsource/archivo";
import "@fontsource/be-vietnam-pro";
import "@fontsource/epilogue";
import "@fontsource/urbanist";
import "@fontsource/onest";
import "@fontsource/fira-code";
import "@fontsource/source-code-pro";
import "@fontsource/space-mono";
import "@fontsource/ibm-plex-mono";
import "@fontsource/anonymous-pro";
import "@fontsource/jetbrains-mono";
import "@fontsource/inconsolata";
import "@fontsource/dm-mono";
import "@fontsource/iosevka";
import "@fontsource/victor-mono";
import "@fontsource/red-hat-mono";
import "@fontsource/sometype-mono";
import "@fontsource/recursive";

export interface FontOption {
  value: string;
  label: string;
  fontFamily?: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { value: "Inter", label: "Inter", fontFamily: "Inter" },
  { value: "Roboto", label: "Roboto", fontFamily: "Roboto" },
  { value: "Open Sans", label: "Open Sans", fontFamily: "Open Sans" },
  { value: "Lato", label: "Lato", fontFamily: "Lato" },
  { value: "Montserrat", label: "Montserrat", fontFamily: "Montserrat" },
  { value: "Raleway", label: "Raleway", fontFamily: "Raleway" },
  { value: "Ubuntu", label: "Ubuntu", fontFamily: "Ubuntu" },
  { value: "Nunito", label: "Nunito", fontFamily: "Nunito" },
  { value: "Manrope", label: "Manrope", fontFamily: "Manrope" },
  { value: "Noto Sans", label: "Noto Sans", fontFamily: "Noto Sans" },
  { value: "Source Sans 3", label: "Source Sans 3", fontFamily: "Source Sans 3" },
  { value: "PT Sans", label: "PT Sans", fontFamily: "PT Sans" },
  { value: "Poppins", label: "Poppins", fontFamily: "Poppins" },
  { value: "Fira Sans", label: "Fira Sans", fontFamily: "Fira Sans" },
  { value: "Barlow", label: "Barlow", fontFamily: "Barlow" },
  { value: "Josefin Sans", label: "Josefin Sans", fontFamily: "Josefin Sans" },
  { value: "Work Sans", label: "Work Sans", fontFamily: "Work Sans" },
  { value: "DM Sans", label: "DM Sans", fontFamily: "DM Sans" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans", fontFamily: "Plus Jakarta Sans" },
  { value: "Figtree", label: "Figtree", fontFamily: "Figtree" },
  { value: "Outfit", label: "Outfit", fontFamily: "Outfit" },
  { value: "Sora", label: "Sora", fontFamily: "Sora" },
  { value: "Lexend", label: "Lexend", fontFamily: "Lexend" },
  { value: "Quicksand", label: "Quicksand", fontFamily: "Quicksand" },
  { value: "Rubik", label: "Rubik", fontFamily: "Rubik" },
  { value: "Mulish", label: "Mulish", fontFamily: "Mulish" },
  { value: "Archivo", label: "Archivo", fontFamily: "Archivo" },
  { value: "Be Vietnam Pro", label: "Be Vietnam Pro", fontFamily: "Be Vietnam Pro" },
  { value: "Epilogue", label: "Epilogue", fontFamily: "Epilogue" },
  { value: "Urbanist", label: "Urbanist", fontFamily: "Urbanist" },
  { value: "Onest", label: "Onest", fontFamily: "Onest" },
];

export const CODE_FONT_OPTIONS: FontOption[] = [
  { value: "JetBrains Mono", label: "JetBrains Mono", fontFamily: "JetBrains Mono" },
  { value: "Fira Code", label: "Fira Code", fontFamily: "Fira Code" },
  { value: "Source Code Pro", label: "Source Code Pro", fontFamily: "Source Code Pro" },
  { value: "Space Mono", label: "Space Mono", fontFamily: "Space Mono" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono", fontFamily: "IBM Plex Mono" },
  { value: "Anonymous Pro", label: "Anonymous Pro", fontFamily: "Anonymous Pro" },
  { value: "Inconsolata", label: "Inconsolata", fontFamily: "Inconsolata" },
  { value: "DM Mono", label: "DM Mono", fontFamily: "DM Mono" },
  { value: "Iosevka", label: "Iosevka", fontFamily: "Iosevka" },
  { value: "Victor Mono", label: "Victor Mono", fontFamily: "Victor Mono" },
  { value: "Red Hat Mono", label: "Red Hat Mono", fontFamily: "Red Hat Mono" },
  { value: "Sometype Mono", label: "Sometype Mono", fontFamily: "Sometype Mono" },
  { value: "Recursive", label: "Recursive", fontFamily: "Recursive" },
];

const FONT_FALLBACKS: Record<string, string> = {
  "Segoe UI": '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif',
  System: "Tahoma, Geneva, Verdana, sans-serif",
};

const MONO_FALLBACKS: Record<string, string> = {
  Consolas: "Consolas, ui-monospace, SFMono-Regular, Menlo, monospace",
  "Cascadia Code": '"Cascadia Code", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  monospace: "monospace",
};

export function applyFont(font: string, codeFont: string): void {
  const fontStack = FONT_FALLBACKS[font] ?? `"${font}", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`;
  const monoStack =
    MONO_FALLBACKS[codeFont] ??
    `"${codeFont}", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  document.documentElement.style.setProperty("--sans", fontStack);
  document.documentElement.style.setProperty("--mono", monoStack);
}

export async function initFonts(): Promise<void> {
  try {
    const vibe = (window as any).vibe;
    if (!vibe?.state) return;
    const [font, codeFont] = await Promise.all([vibe.state.get("settings:font"), vibe.state.get("settings:codeFont")]);
    applyFont(font || "Segoe UI", codeFont || "JetBrains Mono");
  } catch {
    // ignore
  }
}
