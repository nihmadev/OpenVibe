import * as React from "react";

interface FieldContextValue { controlId: string; labelId: string; descriptionId: string; errorId: string; invalid: boolean; disabled: boolean; }
const FieldContext = React.createContext<FieldContextValue | null>(null);
export function useFieldContext(): FieldContextValue | null { return React.useContext(FieldContext); }

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> { invalid?: boolean; disabled?: boolean; }
export const Field: React.ForwardRefExoticComponent<FieldProps & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, FieldProps>(function Field({ invalid = false, disabled = false, className, children, ...props }, ref) {
  const id = React.useId();
  const context = React.useMemo(() => ({ controlId: `${id}-control`, labelId: `${id}-label`, descriptionId: `${id}-description`, errorId: `${id}-error`, invalid, disabled }), [id, invalid, disabled]);
  return <FieldContext.Provider value={context}><div ref={ref} className={["z-field", invalid ? "z-field--invalid" : "", className].filter(Boolean).join(" ")} data-disabled={disabled ? "" : undefined} {...props}>{children}</div></FieldContext.Provider>;
});

export const Label: React.ForwardRefExoticComponent<React.LabelHTMLAttributes<HTMLLabelElement> & React.RefAttributes<HTMLLabelElement>> = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(function Label({ htmlFor, id, className, ...props }, ref) {
  const field = useFieldContext();
  return <label ref={ref} id={id ?? field?.labelId} htmlFor={htmlFor ?? field?.controlId} className={["z-label", className].filter(Boolean).join(" ")} {...props} />;
});
export const Description: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Description({ id, className, ...props }, ref) {
  const field = useFieldContext(); return <div ref={ref} id={id ?? field?.descriptionId} className={["z-description", className].filter(Boolean).join(" ")} {...props} />;
});
export const FieldError: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function FieldError({ id, className, ...props }, ref) {
  const field = useFieldContext(); return <div ref={ref} id={id ?? field?.errorId} className={["z-field-error", className].filter(Boolean).join(" ")} role="alert" {...props} />;
});
