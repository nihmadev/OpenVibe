import * as React from "react";

export interface ControlRowProps extends React.HTMLAttributes<HTMLDivElement> { label: React.ReactNode; description?: React.ReactNode; children: React.ReactElement; }
export function ControlRow({ label, description, children, className, ...props }: ControlRowProps): React.ReactElement {
  const id = React.useId(); const controlId = children.props.id ?? `${id}-control`; const labelId = `${id}-label`; const descriptionId = description ? `${id}-description` : undefined;
  const control = React.cloneElement(children, { id: controlId, "aria-labelledby": children.props["aria-labelledby"] ?? labelId, "aria-describedby": children.props["aria-describedby"] ?? descriptionId } as React.HTMLAttributes<HTMLElement>);
  return <div className={["z-control-row", className].filter(Boolean).join(" ")} {...props}><div className="z-control-info"><label id={labelId} htmlFor={controlId} className="z-control-label">{label}</label>{description ? <div id={descriptionId} className="z-control-desc">{description}</div> : null}</div><div className="z-control-action">{control}</div></div>;
}
