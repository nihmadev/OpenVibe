import * as React from "react";
import { useFieldContext } from "./Field";

const { forwardRef } = React;

/** Size presets for {@link Input}; controls the field's min-height. */
export type InputSize = "sm" | "md" | "lg";

/**
 * Props for {@link Input}.
 * Extends native `input` props with layout helpers for icon, right-side element
 * and the wrapping container.
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Icon rendered inline inside the field, before the text. */
  icon?: React.ReactNode;
  /** Arbitrary node rendered inline inside the field, after the text. */
  rightElement?: React.ReactNode;
  /** Extra class applied to the wrapping `<div>` (e.g. for width control). */
  containerClassName?: string;
  /** Size of the field. @default "md" */
  size?: InputSize;
  /** Props forwarded to the wrapping `<div>` (merged with `containerClassName`). */
  containerProps?: React.HTMLAttributes<HTMLDivElement>;
  invalid?: boolean;
}

/**
 * Text input with an inline wrapper, icon and optional right-side element.
 *
 * Renders a wrapping `<div>` (class `z-input-wrap`, size modifier
 * `--sm|--md|--lg`) around a plain `<input>`. Focus styles land on the wrapper
 * via `:focus-within`, so the whole field highlights as one unit.
 *
 * ```tsx
 * <Input
 *   icon={<SearchIcon />}
 *   rightElement={isLoading ? <Spinner /> : undefined}
 *   placeholder="Search…"
 *   value={query}
 *   onChange={(e) => setQuery(e.target.value)}
 * />
 * ```
 */
export const Input: React.ForwardRefExoticComponent<InputProps & React.RefAttributes<HTMLInputElement>> = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      containerProps,
      icon,
      rightElement,
      size = "md",
      invalid,
      ...props
    },
    ref,
  ): React.ReactElement => {
    const field = useFieldContext();
    const { className: containerPropsClassName, ...restContainerProps } = containerProps ?? {};
    const isInvalid = invalid ?? ((props["aria-invalid"] === true || props["aria-invalid"] === "true") || field?.invalid || false);
    const isDisabled = props.disabled ?? field?.disabled;
    const describedBy = [props["aria-describedby"], field?.descriptionId, isInvalid ? field?.errorId : undefined].filter(Boolean).join(" ") || undefined;
    const containerClasses = ["z-input-wrap", `z-input-wrap--${size}`, isInvalid ? "z-input-wrap--invalid" : "", isDisabled ? "z-input-wrap--disabled" : "", containerPropsClassName, containerClassName]
      .filter(Boolean)
      .join(" ");
    const inputClasses = ["z-input", className].filter(Boolean).join(" ");

    return (
      <div className={containerClasses} {...restContainerProps}>
        {icon && <span className="z-input-icon">{icon}</span>}
        <input {...props} ref={ref} id={props.id ?? field?.controlId} className={inputClasses} disabled={isDisabled} aria-labelledby={props["aria-labelledby"] ?? field?.labelId} aria-describedby={describedBy} aria-invalid={isInvalid || undefined} />
        {rightElement && <span className="z-input-right">{rightElement}</span>}
      </div>
    );
  },
);

Input.displayName = "Input";
