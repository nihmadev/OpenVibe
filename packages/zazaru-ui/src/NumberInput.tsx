import * as React from "react";

export interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "size"> {
  value: string;
  onChange: (value: string, event?: React.ChangeEvent<HTMLInputElement>) => void;
  step?: number;
  min?: number;
  max?: number;
  precision?: number;
  decrementLabel?: string;
  incrementLabel?: string;
  containerClassName?: string;
}

function decimalPlaces(value: number): number {
  const text = String(value).toLowerCase();
  if (text.includes("e-")) return Number(text.split("e-")[1]);
  return text.includes(".") ? text.split(".")[1]!.length : 0;
}

function clamp(value: number, min?: number, max?: number): number {
  return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, value));
}

function StepIcon({ plus = false }: { plus?: boolean }): React.ReactElement {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14" />{plus ? <path d="M12 5v14" /> : null}</svg>;
}

export const NumberInput: React.ForwardRefExoticComponent<NumberInputProps & React.RefAttributes<HTMLInputElement>> = React.forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  {
    value,
    step = 1,
    min,
    max,
    precision = decimalPlaces(step),
    onChange,
    disabled,
    readOnly,
    className,
    containerClassName,
    decrementLabel = "Decrease value",
    incrementLabel = "Increase value",
    onKeyDown,
    ...props
  },
  ref,
) {
  const parsed = value.trim() === "" ? Number.NaN : Number(value);
  const valid = Number.isFinite(parsed);
  const format = (next: number) => precision > 0 ? next.toFixed(precision) : String(Math.round(next));
  const stepBy = (direction: -1 | 1) => {
    if (disabled || readOnly) return;
    const base = valid ? parsed : direction > 0 ? (min ?? 0) - step : (max ?? 0) + step;
    onChange(format(clamp(base + direction * step, min, max)));
  };
  const decrementDisabled = disabled || readOnly || (valid && min !== undefined && parsed <= min);
  const incrementDisabled = disabled || readOnly || (valid && max !== undefined && parsed >= max);

  return (
    <div className={["z-number-input", containerClassName].filter(Boolean).join(" ")} data-disabled={disabled ? "" : undefined}>
      <button type="button" className="z-number-input__button" onClick={() => stepBy(-1)} disabled={decrementDisabled} aria-label={decrementLabel} tabIndex={-1}><StepIcon /></button>
      <input
        {...props}
        ref={ref}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        className={["z-number-input__field", className].filter(Boolean).join(" ")}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={valid ? parsed : undefined}
        aria-valuetext={valid ? undefined : value || "Empty"}
        onChange={(event) => onChange(event.target.value, event)}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (event.defaultPrevented) return;
          if (event.key === "ArrowUp") { event.preventDefault(); stepBy(1); }
          if (event.key === "ArrowDown") { event.preventDefault(); stepBy(-1); }
          if (event.key === "Home" && min !== undefined) { event.preventDefault(); onChange(format(min)); }
          if (event.key === "End" && max !== undefined) { event.preventDefault(); onChange(format(max)); }
        }}
      />
      <button type="button" className="z-number-input__button" onClick={() => stepBy(1)} disabled={incrementDisabled} aria-label={incrementLabel} tabIndex={-1}><StepIcon plus /></button>
    </div>
  );
});
