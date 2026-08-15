import * as React from "react";
import { useFieldContext } from "./Field";
import { Input, type InputProps } from "./Input";

export const Textarea: React.ForwardRefExoticComponent<React.TextareaHTMLAttributes<HTMLTextAreaElement> & React.RefAttributes<HTMLTextAreaElement>> = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ id, className, disabled, "aria-describedby": describedBy, "aria-invalid": invalid, ...props }, ref) {
  const field = useFieldContext();
  const description = [describedBy, field?.descriptionId, field?.invalid ? field.errorId : undefined].filter(Boolean).join(" ") || undefined;
  return <textarea ref={ref} id={id ?? field?.controlId} disabled={disabled ?? field?.disabled} aria-labelledby={field?.labelId} aria-describedby={description} aria-invalid={(invalid ?? field?.invalid) || undefined} className={["z-textarea", className].filter(Boolean).join(" ")} {...props} />;
});

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> { label: React.ReactNode; indeterminate?: boolean; }
export const Checkbox: React.ForwardRefExoticComponent<CheckboxProps & React.RefAttributes<HTMLInputElement>> = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({ label, indeterminate, className, ...props }, forwardedRef) {
  const localRef = React.useRef<HTMLInputElement>(null);
  React.useImperativeHandle(forwardedRef, () => localRef.current!);
  React.useEffect(() => { if (localRef.current) localRef.current.indeterminate = Boolean(indeterminate); }, [indeterminate]);
  return <label className={["z-check-control", className].filter(Boolean).join(" ")}><input {...props} ref={localRef} type="checkbox" aria-checked={indeterminate ? "mixed" : props.checked} /><span className="z-check-control__box" aria-hidden="true">{indeterminate ? "−" : "✓"}</span><span>{label}</span></label>;
});

export interface RadioOption<Value extends string = string> { value: Value; label: React.ReactNode; description?: React.ReactNode; disabled?: boolean; }
export interface RadioGroupProps<Value extends string = string> extends Omit<React.FieldsetHTMLAttributes<HTMLFieldSetElement>, "onChange"> { legend: React.ReactNode; value?: Value; defaultValue?: Value; options: readonly RadioOption<Value>[]; onChange?: (value: Value) => void; }
export function RadioGroup<Value extends string = string>({ legend, value, defaultValue, options, onChange, className, ...props }: RadioGroupProps<Value>): React.ReactElement {
  const name = React.useId();
  return <fieldset className={["z-radio-group", className].filter(Boolean).join(" ")} {...props}><legend className="z-label">{legend}</legend>{options.map((option) => <label key={option.value} className="z-radio"><input type="radio" name={name} value={option.value} checked={value === undefined ? undefined : value === option.value} defaultChecked={value === undefined ? defaultValue === option.value : undefined} disabled={option.disabled} onChange={() => onChange?.(option.value)} /><span><span>{option.label}</span>{option.description ? <span className="z-description">{option.description}</span> : null}</span></label>)}</fieldset>;
}

export interface SearchFieldProps extends Omit<InputProps, "type"> { label: string; onClear?: () => void; clearLabel?: string; }
export const SearchField: React.ForwardRefExoticComponent<SearchFieldProps & React.RefAttributes<HTMLInputElement>> = React.forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({ label, onClear, clearLabel = "Clear search", rightElement, ...props }, ref) {
  const labelId = React.useId();
  const clear = onClear ? <button type="button" className="z-search-clear" aria-label={clearLabel} onClick={onClear}>×</button> : null;
  return <div role="search" className="z-search-field"><label id={labelId} className="z-visually-hidden">{label}</label><Input ref={ref} type="search" aria-labelledby={props["aria-labelledby"] ?? labelId} rightElement={rightElement ?? clear} {...props} /></div>;
});
