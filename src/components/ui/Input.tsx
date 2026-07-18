import React from "react";
import "./ui.css";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, containerClassName, icon, rightElement, ...props }, ref) => {
    return (
      <div className={`ui-input-wrap ${containerClassName || ""}`.trim()}>
        {icon && <div className="ui-input-icon">{icon}</div>}
        <input ref={ref} className={`ui-input ${className || ""}`.trim()} {...props} />
        {rightElement && <div className="ui-input-right">{rightElement}</div>}
      </div>
    );
  },
);
Input.displayName = "Input";
