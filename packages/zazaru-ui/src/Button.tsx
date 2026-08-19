import * as React from "react";

/** Visual variants of {@link Button}. */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * Props for {@link Button}.
 * Extends the native `button` element props; `variant` and `icon` add the library's
 * visual styling on top.
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual treatment of the button.
   *
   * - `primary` - filled with the accent color, meant for the single main action.
   * - `secondary` - subtle filled surface, the default.
   * - `ghost` - transparent until hovered, for low-emphasis actions.
   * - `danger` - error-colored, for destructive actions.
   * - `outline` - transparent with a border.
   *
   * @default "secondary"
   */
  variant?: ButtonVariant;
  /** @deprecated Use `leadingIcon`. */
  icon?: React.ReactNode;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
}

/**
 * Primary action button.
 *
 * Renders a native `<button>` with the `z-button` class and `z-button--{variant}`
 * modifier. When `icon` is provided it is rendered before the children; the label
 * (`children`) is wrapped in a `<span>` so the two can be spaced apart by CSS.
 *
 * ```tsx
 * <Button variant="primary" icon={<SendIcon />} onClick={handleSend}>
 *   Send
 * </Button>
 * ```
 */
export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>> = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon,
    leadingIcon = icon,
    trailingIcon,
    loading = false,
    loadingLabel = "Loading",
    children,
    className,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  const classes = ["z-button", `z-button--${variant}`, `z-button--${size}`, className].filter(Boolean).join(" ");
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <span className="z-spinner z-spinner--sm" aria-hidden="true" /> : leadingIcon ? <span className="z-button__icon" aria-hidden="true">{leadingIcon}</span> : null}
      {children ? <span className="z-button__label">{children}</span> : null}
      {loading ? <span className="z-visually-hidden">{loadingLabel}</span> : trailingIcon ? <span className="z-button__icon" aria-hidden="true">{trailingIcon}</span> : null}
    </button>
  );
});
