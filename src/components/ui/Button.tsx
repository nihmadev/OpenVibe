import React from "react";
import "./ui.css";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", icon, children, ...props }, ref) => {
    const cls = `ui-button ui-button--${variant} ${className || ""}`;
    return (
      <button ref={ref} className={cls.trim()} {...props}>
        {icon}
        {children && <span>{children}</span>}
      </button>
    );
  },
);
Button.displayName = "Button";
