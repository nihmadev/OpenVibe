import React from "react";
import "./ui.css";

export type SurfaceTone = "chrome" | "canvas" | "panel" | "composer" | "bubble";

export function surfaceClassName(tone: SurfaceTone, className?: string): string {
  return `ui-surface ui-surface--${tone}${className ? ` ${className}` : ""}`;
}

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: SurfaceTone;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ tone = "panel", className, ...props }, ref) => (
    <div ref={ref} className={surfaceClassName(tone, className)} {...props} />
  ),
);

Surface.displayName = "Surface";
