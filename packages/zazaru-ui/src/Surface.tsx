import * as React from "react";

/**
 * Semantic surface roles for {@link Surface}.
 *
 * Each tone maps to a semantic `--z-color-surface-*` theme token, so layout components stay
 * independent from the current canvas treatment. Change the tokens to
 * restyle the whole shell globally.
 *
 * - `canvas` – the large continuous application plane; it fills its parent and never rounds itself.
 * - `inset` – a quiet area recessed into that plane.
 * - `panel` – a tonal content group without implied elevation.
 * - `raised` – a subtly elevated region.
 * - `floating` – a transient or deliberately detached surface.
 */
export type SurfaceTone = "transparent" | "canvas" | "inset" | "panel" | "raised" | "floating";

/**
 * Builds the `z-surface z-surface--{tone}` class string for {@link Surface},
 * optionally merged with `className`.
 */
export function surfaceClassName(tone: SurfaceTone, className?: string): string {
  return ["z-surface", `z-surface--${tone}`, className].filter(Boolean).join(" ");
}

/**
 * Props for {@link Surface}. Extends native `div` props.
 */
export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Semantic surface role. @default "panel"
   */
  tone?: SurfaceTone;
}

/**
 * Themed container div.
 *
 * A thin wrapper around a plain `<div>` that applies one of the semantic
 * surface styles (`z-surface` + `z-surface--{tone}`). Use it for chat
 * bubbles, panels, the composer and the app canvas.
 *
 * ```tsx
 * <Surface tone="raised" className="panel">Hello</Surface>
 * <div className={surfaceClassName("canvas", "layout__chat")}>…</div>
 * ```
 */
export const Surface: React.ForwardRefExoticComponent<SurfaceProps & React.RefAttributes<HTMLDivElement>> =
  React.forwardRef<HTMLDivElement, SurfaceProps>(
    ({ tone = "panel", className, ...props }, ref): React.ReactElement => (
      <div ref={ref} className={surfaceClassName(tone, className)} {...props} />
    ),
  );

Surface.displayName = "Surface";
