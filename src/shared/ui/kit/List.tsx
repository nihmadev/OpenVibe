import React, { useState } from "react";
import "./ui.css";

export interface ListProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  stagger?: boolean;
}

export function List({ children, className, stagger = true, ...props }: ListProps) {
  const content = stagger
    ? React.Children.map(children, (child, i) => {
        if (React.isValidElement(child)) {
          const childStyle = {
            "--delay": i,
            ...((child.props as any).style || {}),
          } as React.CSSProperties;
          return React.cloneElement(child as React.ReactElement<any>, {
            index: (child.props as any).index !== undefined ? (child.props as any).index : i,
            style: childStyle,
          });
        }
        return child;
      })
    : children;

  return (
    <div className={`ui-list ${className || ""}`.trim()} {...props}>
      {content}
    </div>
  );
}

export interface ListGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  icon?: React.ReactNode;
  index?: number;
  children: React.ReactNode;
}

export function ListGroup({
  title,
  defaultExpanded = true,
  expanded,
  onToggle,
  icon,
  index,
  children,
  className,
  style,
  ...props
}: ListGroupProps) {
  const isControlled = expanded !== undefined;
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  const isExpanded = isControlled ? expanded : internalExpanded;

  const handleToggle = () => {
    if (!isControlled) {
      setInternalExpanded(!isExpanded);
    }
    if (onToggle) {
      onToggle(!isExpanded);
    }
  };

  const computedStyle = {
    ...(index !== undefined ? { "--delay": index } : {}),
    ...(style || {}),
  } as React.CSSProperties;

  return (
    <div
      className={`ui-list-group ${isExpanded ? "ui-list-group--expanded" : "ui-list-group--collapsed"} ${className || ""}`.trim()}
      style={computedStyle}
      {...props}
    >
      <button type="button" className="ui-list-group__header" onClick={handleToggle}>
        <div className="ui-list-group__header-content">
          {icon && <span className="ui-list-group__icon">{icon}</span>}
          <span className="ui-list-group__title">{title}</span>
        </div>
        <svg
          className="ui-list-group__chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div
        className={`ui-list-group__content ${isExpanded ? "ui-list-group__content--expanded" : "ui-list-group__content--collapsed"}`}
      >
        {children}
      </div>
    </div>
  );
}

export interface ListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  index?: number;
}

export function ListItem({ children, active, leftIcon, rightIcon, index, className, style, ...props }: ListItemProps) {
  const computedStyle = {
    ...(index !== undefined ? { "--delay": index } : {}),
    ...(style || {}),
  } as React.CSSProperties;

  return (
    <button
      type="button"
      className={`ui-list-item ${active ? "ui-list-item--active" : ""} ${className || ""}`.trim()}
      style={computedStyle}
      {...props}
    >
      {leftIcon && <span className="ui-list-item__icon ui-list-item__icon--left">{leftIcon}</span>}
      <span className="ui-list-item__content">{children}</span>
      {rightIcon && <span className="ui-list-item__icon ui-list-item__icon--right">{rightIcon}</span>}
    </button>
  );
}
