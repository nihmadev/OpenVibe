import React from "react";
import "./ui.css";

interface ToggleProps extends React.InputHTMLAttributes<HTMLInputElement> {
  checked: boolean;
  onChange?: (e: any) => void;
  onValueChange?: (checked: boolean) => void;
}

export const Toggle = React.forwardRef<HTMLInputElement, ToggleProps>(
  ({ className, checked, onChange, onValueChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) onChange(e);
      if (onValueChange) onValueChange(e.target.checked);
    };

    return (
      <label className={`ui-toggle ${className || ""}`.trim()}>
        <input type="checkbox" ref={ref} checked={checked} onChange={handleChange} {...props} />
        <span className="ui-toggle__slider"></span>
      </label>
    );
  },
);
Toggle.displayName = "Toggle";
