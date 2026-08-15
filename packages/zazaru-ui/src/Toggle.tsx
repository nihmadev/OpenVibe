import * as React from "react";

/** Size presets for {@link Toggle}. */
export type ToggleSize = "sm" | "md" | "lg";

/**
 * Props for {@link Toggle}.
 * Extends native `input` props (except `type`, which is forced to `checkbox`).
 * The component is controlled: provide `checked` and react to changes either
 * through `onValueChange` or the native `onChange`.
 */
export interface ToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Whether the toggle is on. The component is fully controlled. */
  checked: boolean;
  /**
   * Convenience callback that receives the new boolean value.
   * Fired in addition to the native `onChange`.
   */
  onValueChange?: (checked: boolean) => void;
  /** Size of the toggle. @default "md" */
  size?: ToggleSize;
  /** Props forwarded to the wrapping `<label>` (merged with `className`). */
  labelProps?: React.LabelHTMLAttributes<HTMLLabelElement>;
  /** Visible label. When omitted, supply aria-label or aria-labelledby. */
  label?: React.ReactNode;
}

/**
 * Controlled switch/toggle.
 *
 * Renders a hidden native checkbox inside a `<label>` styled as a sliding
 * switch (class `z-toggle`, size modifier `--sm|--md|--lg`). Because it is a
 * real `<input type="checkbox">`, the toggle works with forms and
 * screen-readers out of the box.
 *
 * ```tsx
 * <Toggle checked={enabled} onValueChange={setEnabled} />
 * <Toggle checked={enabled} size="sm" labelProps={{ title: "Enable feature" }} />
 * ```
 */
export const Toggle: React.ForwardRefExoticComponent<ToggleProps & React.RefAttributes<HTMLInputElement>> =
  React.forwardRef<HTMLInputElement, ToggleProps>(
    ({ className, checked, onChange, onValueChange, size = "md", labelProps, label, disabled, ...props }, ref): React.ReactElement => {
      const { className: labelClassName, ...restLabelProps } = labelProps ?? {};
      const classes = ["z-toggle", `z-toggle--${size}`, labelClassName, className]
        .filter(Boolean)
        .join(" ");

      return (
        <label className={classes} data-disabled={disabled ? "" : undefined} {...restLabelProps}>
          <input
            {...props}
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => {
              onChange?.(event);
              onValueChange?.(event.target.checked);
            }}
          />
          <span className="z-toggle__slider" aria-hidden="true" />
          {label ? <span className="z-toggle__label">{label}</span> : null}
        </label>
      );
    },
  );

Toggle.displayName = "Toggle";
