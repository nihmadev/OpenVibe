import type { ReactNode } from "react";

export const PROMPT_SUGGESTION_KEYS = [
  "promptSuggestionStart",
  "promptSuggestionWorkspace",
  "promptSuggestionCode",
  "promptSuggestionEntry",
  "promptSuggestionBlocker",
  "promptSuggestionStructure",
  "promptSuggestionNext",
] as const;

type PlaceholderInput = {
  mode: "normal" | "shell";
  suggest: boolean;
  example: string;
  disabled: boolean;
  t: (key: string) => string;
};

export function promptPlaceholder(input: PlaceholderInput, suggestion?: string): ReactNode {
  if (input.disabled) return input.t("processing");
  if (input.mode === "shell") return `$ ${input.example}`;
  return suggestion ?? input.t("vibeAnything");
}
