export type RecipeSurfaceTone = "composer" | "bubble";
export function recipeSurfaceClassName(tone: RecipeSurfaceTone, className?: string): string { return ["z-recipe-surface", `z-recipe-surface--${tone}`, className].filter(Boolean).join(" "); }
