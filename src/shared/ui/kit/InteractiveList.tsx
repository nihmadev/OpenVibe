import type React from "react";
import "./ui.css";

export interface InteractiveListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function interactiveListClassName(className?: string): string {
  return `ui-interactive-list ${className || ""}`.trim();
}

export function interactiveItemClassName(active = false, className?: string): string {
  return `ui-interactive-item${active ? " ui-interactive-item--active" : ""} ${className || ""}`.trim();
}

export function InteractiveList({ children, className, ...props }: InteractiveListProps): React.ReactElement {
  return (
    <div className={interactiveListClassName(className)} {...props}>
      {children}
    </div>
  );
}
