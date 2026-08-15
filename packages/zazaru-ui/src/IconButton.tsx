import * as React from "react";

/** Size presets for {@link IconButton}: 24/28/32px squares. */
export type IconButtonScale = "compact" | "regular" | "large";

/** Visual tone of {@link IconButton}. */
export type IconButtonTone = "quiet" | "solid" | "danger";

/**
 * Props for {@link IconButton}.
 * Extends native `button` props; only icon content is expected as `children`.
 */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name. Prefer this over a title-only label. */
  "aria-label": string;
  /**
   * Marks the button as toggled/active. Rendered as `aria-pressed` and styled
   * with the `--pressed` modifier.
   */
  pressed?: boolean;
  /** @default "regular" */
  scale?: IconButtonScale;
  /** @default "quiet" */
  tone?: IconButtonTone;
  /**
   * Shows a spinner instead of the icon and disables the button while true.
   * Also sets `aria-busy`.
   */
  loading?: boolean;
}

/**
 * Square icon-only button — the single primitive for all icon actions
 * (toolbar buttons, panel headers, list-row actions).
 *
 * ```tsx
 * <IconButton pressed={view === "grid"} onPress={showGrid} title="Grid view">
 *   <GridIcon />
 * </IconButton>
 * <IconButton tone="danger" onClick={handleDelete} aria-label="Delete file">
 *   <TrashIcon />
 * </IconButton>
 * ```
 */
export const IconButton: React.ForwardRefExoticComponent<
  IconButtonProps & React.RefAttributes<HTMLButtonElement>
> = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { children, className, disabled, loading = false, pressed = false, scale = "regular", tone = "quiet", type = "button", ...props },
    ref,
  ): React.ReactElement => {
    const classes = [
      "z-icon-button",
      `z-icon-button--${scale}`,
      `z-icon-button--${tone}`,
      pressed ? "z-icon-button--pressed" : "",
      loading ? "z-icon-button--loading" : "",
      className,
    ].filter(Boolean).join(" ");

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        aria-pressed={props["aria-pressed"] ?? (pressed ? true : undefined)}
        {...props}
      >
        {loading ? <span className="z-spinner z-spinner--sm" aria-hidden="true" /> : children}
      </button>
    );
  },
);

IconButton.displayName = "IconButton";
