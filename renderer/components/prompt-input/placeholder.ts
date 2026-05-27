import { ReactNode } from "react"

type PlaceholderInput = {
  mode: "normal" | "shell"
  suggest: boolean
  example: string
  disabled: boolean
  t: (key: string) => string
}

export function promptPlaceholder(input: PlaceholderInput): ReactNode {
  if (input.disabled) return input.t("processing")
  if (input.mode === "shell") return `$ ${input.example}`
  return input.t("vibeAnything")
}
