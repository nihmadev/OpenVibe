import React from "react";
import "./ui.css";

interface ControlRowProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const ControlRow: React.FC<ControlRowProps> = ({ label, description, children, className }) => {
  return (
    <div className={`ui-control-row ${className || ""}`.trim()}>
      <div className="ui-control-info">
        <div className="ui-control-label">{label}</div>
        {description && <div className="ui-control-desc">{description}</div>}
      </div>
      <div className="ui-control-action">{children}</div>
    </div>
  );
};
