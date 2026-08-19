import * as React from "react";

/**
 * Builds the `z-interactive-list` class name for interactive row containers,
 * optionally merged with `className`.
 *
 * The list container is a flex column whose items get hover/active row
 * styling from `.z-interactive-item`.
 */
export function interactiveListClassName(className?: string): string {
  return ["z-interactive-list", className].filter(Boolean).join(" ");
}

/**
 * Builds the `z-interactive-item[--active]` class name for a single row,
 * optionally merged with `className`.
 *
 * Rows get a hover background and a pressed/selected background via
 * `--interactive-item-hover` / `--interactive-item-active` theme tokens.
 */
export function interactiveItemClassName(active = false, className?: string): string {
  return ["z-interactive-item", active ? "z-interactive-item--active" : "", className].filter(Boolean).join(" ");
}

/**
 * Props for {@link InteractiveList}.
 */
export interface InteractiveListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Row content: elements using `interactiveItemClassName`. */
  children: React.ReactNode;
}

/**
 * Plain flex column that applies interactive row styling to its children.
 *
 * Most consumers only need the `interactiveListClassName` /
 * `interactiveItemClassName` helpers; this component is a convenience wrapper
 * around a `<div>` for when you want the bare container without `List`'s
 * stagger animation.
 *
 * ```tsx
 * <InteractiveList>
 *   <div className={interactiveItemClassName(active)}>Row</div>
 * </InteractiveList>
 * ```
 */
export function InteractiveList({ children, className, ...props }: InteractiveListProps): React.ReactElement {
  return (
    <div className={interactiveListClassName(className)} {...props}>
      {children}
    </div>
  );
}
