import React from "react";
import "./ui.css";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual size: sm = 24px, md = 28px, lg = 32px */
  size?: "sm" | "md" | "lg";
  /** Marks the button as toggled/active */
  active?: boolean;
}

/**
 * Ghost icon button — the single primitive for all icon-only actions
 * (titlebar, panel headers, message actions, list rows).
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, size = "md", active, children, type, ...props }, ref) => {
    const cls = ["ui-icon-btn", `ui-icon-btn--${size}`, active ? "ui-icon-btn--active" : "", className || ""]
      .filter(Boolean)
      .join(" ");
    return (
      <button ref={ref} type={type ?? "button"} className={cls} {...props}>
        {children}
      </button>
    );
  },
);
IconButton.displayName = "IconButton";
