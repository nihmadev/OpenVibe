import { appState } from "@/platform/storage/common/keyValueStore";

type FontModuleLoader = () => Promise<unknown>;

// Literal imports are intentional: Vite emits one lazy CSS chunk per family.
const FONT_LOADERS: Record<string, FontModuleLoader> = {
  Inter: () => import("@fontsource/inter/400.css"),
  Roboto: () => import("@fontsource/roboto/400.css"),
  "Open Sans": () => import("@fontsource/open-sans/400.css"),
  Nunito: () => import("@fontsource/nunito/400.css"),
  Manrope: () => import("@fontsource/manrope/400.css"),
  Poppins: () => import("@fontsource/poppins/400.css"),
  Lato: () => import("@fontsource/lato/400.css"),
  Montserrat: () => import("@fontsource/montserrat/400.css"),
  Raleway: () => import("@fontsource/raleway/400.css"),
  Ubuntu: () => import("@fontsource/ubuntu/400.css"),
  "Noto Sans": () => import("@fontsource/noto-sans/400.css"),
  "Source Sans 3": () => import("@fontsource/source-sans-3/400.css"),
  "PT Sans": () => import("@fontsource/pt-sans/400.css"),
  "Fira Sans": () => import("@fontsource/fira-sans/400.css"),
  Barlow: () => import("@fontsource/barlow/400.css"),
  "Josefin Sans": () => import("@fontsource/josefin-sans/400.css"),
  "Work Sans": () => import("@fontsource/work-sans/400.css"),
  "DM Sans": () => import("@fontsource/dm-sans/400.css"),
  "Plus Jakarta Sans": () => import("@fontsource/plus-jakarta-sans/400.css"),
  Figtree: () => import("@fontsource/figtree/400.css"),
  Outfit: () => import("@fontsource/outfit/400.css"),
  Sora: () => import("@fontsource/sora/400.css"),
  Lexend: () => import("@fontsource/lexend/400.css"),
  Quicksand: () => import("@fontsource/quicksand/400.css"),
  Rubik: () => import("@fontsource/rubik/400.css"),
  Mulish: () => import("@fontsource/mulish/400.css"),
  Archivo: () => import("@fontsource/archivo/400.css"),
  "Be Vietnam Pro": () => import("@fontsource/be-vietnam-pro/400.css"),
  Epilogue: () => import("@fontsource/epilogue/400.css"),
  Urbanist: () => import("@fontsource/urbanist/400.css"),
  Onest: () => import("@fontsource/onest/400.css"),
  "Fira Code": () => import("@fontsource/fira-code/400.css"),
  "Source Code Pro": () => import("@fontsource/source-code-pro/400.css"),
  "Space Mono": () => import("@fontsource/space-mono/400.css"),
  "IBM Plex Mono": () => import("@fontsource/ibm-plex-mono/400.css"),
  "Anonymous Pro": () => import("@fontsource/anonymous-pro/400.css"),
  "JetBrains Mono": () => import("@fontsource/jetbrains-mono/400.css"),
  Inconsolata: () => import("@fontsource/inconsolata/400.css"),
  "DM Mono": () => import("@fontsource/dm-mono/400.css"),
  Iosevka: () => import("@fontsource/iosevka/400.css"),
  "Victor Mono": () => import("@fontsource/victor-mono/400.css"),
  "Red Hat Mono": () => import("@fontsource/red-hat-mono/400.css"),
  "Sometype Mono": () => import("@fontsource/sometype-mono/400.css"),
  Recursive: () => import("@fontsource/recursive/400.css"),
};

const FONT_LOAD_PROMISES = new Map<string, Promise<boolean>>();
let applyGeneration = 0;

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

export function loadFont(font: string): Promise<boolean> {
  const loader = FONT_LOADERS[font];
  if (!loader) return Promise.resolve(true);
  const existing = FONT_LOAD_PROMISES.get(font);
  if (existing) return existing;
  const loading = loader().then(
    () => true,
    () => false,
  );
  FONT_LOAD_PROMISES.set(font, loading);
  return loading;
}

export async function applyFont(font: string, codeFont: string): Promise<void> {
  const generation = ++applyGeneration;
  const [fontLoaded, codeFontLoaded] = await Promise.all([loadFont(font), loadFont(codeFont)]);
  if (generation !== applyGeneration) return;
  const fontStack = fontLoaded
    ? (FONT_FALLBACKS[font] ?? `"${font}", "Segoe UI", Tahoma, Geneva, Verdana, sans-serif`)
    : FONT_FALLBACKS.System;
  const monoStack = codeFontLoaded
    ? (MONO_FALLBACKS[codeFont] ??
      `"${codeFont}", "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`)
    : MONO_FALLBACKS.monospace;
  document.documentElement.style.setProperty("--sans", fontStack);
  document.documentElement.style.setProperty("--mono", monoStack);
}

export async function initFonts(): Promise<void> {
  try {
    const [font, codeFont] = await Promise.all([appState.get("settings:font"), appState.get("settings:codeFont")]);
    await applyFont(font || "Segoe UI", codeFont || "JetBrains Mono");
  } catch {
    // ignore
  }
}
