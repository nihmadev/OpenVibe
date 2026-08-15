import * as React from "react";

/**
 * Props for {@link List}.
 * Extends native `div` props.
 */
export interface ListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** List content: {@link ListGroup} and/or {@link ListItem} elements. */
  children: React.ReactNode;
  /**
   * Whether direct items get a staggered slide-in animation (each item is
   * assigned a `--z-list-delay` index). Nested groups keep their own delay.
   * @default true
   */
  stagger?: boolean;
}

/**
 * Props for {@link ListGroup}. Extends native `div` props (minus `title`).
 */
export interface ListGroupProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Collapsible header title of the group. */
  title: React.ReactNode;
  /** Initial expanded state for uncontrolled usage. @default true */
  defaultExpanded?: boolean;
  /** Controlled expanded state. Provide together with `onToggle` to own the state. */
  expanded?: boolean;
  /** Called with the next expanded state when the header is clicked. */
  onToggle?: (expanded: boolean) => void;
  /** Optional icon rendered before the title. */
  icon?: React.ReactNode;
  /** Stagger index for the slide-in animation (set automatically by {@link List}). */
  index?: number;
  /** Group content: {@link ListItem} elements. */
  children: React.ReactNode;
}

/**
 * Props for {@link ListItem}.
 * Extends native `button` props.
 */
export interface ListItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Highlights the item as the currently active/selected one. */
  active?: boolean;
  /** Icon rendered at the start of the item. */
  leftIcon?: React.ReactNode;
  /** Icon rendered at the end of the item (e.g. a chevron or check). */
  rightIcon?: React.ReactNode;
  /** Stagger index for the slide-in animation (set automatically by {@link List}). */
  index?: number;
}

/** Builds the `z-list` class name for {@link List}, optionally merged with `className`. */
export function listClassName(className?: string): string {
  return ["z-list", className].filter(Boolean).join(" ");
}

/** Builds the `z-list-item[--active]` class name, optionally merged with `className`. */
export function listItemClassName(active = false, className?: string): string {
  return ["z-list-item", active ? "z-list-item--active" : "", className].filter(Boolean).join(" ");
}

/**
 * Vertical list with staggered entrance animation.
 *
 * Wraps `children` in a `z-list` container and, when `stagger` is enabled,
 * clones each direct child to assign an incremental `--z-list-delay` (and a
 * matching `index` prop for `ListGroup`/`ListItem`). The actual delay is
 * applied by `styles/list.css`.
 *
 * ```tsx
 * <List>
 *   <ListItem active leftIcon={<FileIcon />}>README.md</ListItem>
 *   <ListItem leftIcon={<FileIcon />}>index.ts</ListItem>
 * </List>
 * ```
 */
export function List({ children, className, stagger = true, ...props }: ListProps): React.ReactElement {
  const content = stagger
    ? React.Children.map(children, (child, index) => {
        if (!React.isValidElement(child) || (child.type !== ListItem && child.type !== ListGroup)) return child;
        const childProps = child.props as { index?: number; style?: React.CSSProperties };
        return React.cloneElement(child, {
          index: childProps.index ?? index,
          style: { "--z-list-delay": index, ...childProps.style } as React.CSSProperties,
        });
      })
    : children;

  return <div className={listClassName(className)} {...props}>{content}</div>;
}

/**
 * Collapsible group used inside a {@link List}.
 *
 * Renders a clickable header with the `title` (and optional `icon`); the body
 * expands/collapses with a max-height transition. Works both uncontrolled
 * (`defaultExpanded`) and controlled (`expanded` + `onToggle`). Header exposes
 * `aria-expanded` for assistive tech.
 */
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
}: ListGroupProps): React.ReactElement {
  const [internalExpanded, setInternalExpanded] = React.useState(defaultExpanded);
  const generatedId = React.useId();
  const contentId = `${generatedId}-content`;
  const isExpanded = expanded ?? internalExpanded;
  const toggle = () => {
    const next = !isExpanded;
    if (expanded === undefined) setInternalExpanded(next);
    onToggle?.(next);
  };

  return (
    <div className={["z-list-group", isExpanded ? "z-list-group--expanded" : "z-list-group--collapsed", className].filter(Boolean).join(" ")} style={{ "--z-list-delay": index, ...style } as React.CSSProperties} {...props}>
      <button type="button" className="z-list-group__header" onClick={toggle} aria-expanded={isExpanded} aria-controls={contentId}>
        <span className="z-list-group__header-content">
          {icon && <span className="z-list-group__icon">{icon}</span>}
          <span className="z-list-group__title">{title}</span>
        </span>
        <svg className="z-list-group__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div id={contentId} className={["z-list-group__content", isExpanded ? "z-list-group__content--expanded" : "z-list-group__content--collapsed"].join(" ")} hidden={!isExpanded}>
        {children}
      </div>
    </div>
  );
}

/**
 * Single selectable row inside a {@link List} or {@link ListGroup}.
 *
 * Renders a native `<button>` with optional `leftIcon`/`rightIcon` and an
 * `active` visual state. Can be used standalone or as a child of `List` (which
 * supplies the `index` for the stagger animation automatically).
 *
 * ```tsx
 * <ListItem active leftIcon={<FileIcon />} onClick={openFile}>
 *   src/index.ts
 * </ListItem>
 * ```
 */
export function ListItem({ children, active = false, leftIcon, rightIcon, index, className, style, type = "button", ...props }: ListItemProps): React.ReactElement {
  return (
    <button type={type} aria-current={props["aria-current"] ?? (active ? "page" : undefined)} className={listItemClassName(active, className)} style={{ "--z-list-delay": index, ...style } as React.CSSProperties} {...props}>
      {leftIcon && <span className="z-list-item__icon z-list-item__icon--left">{leftIcon}</span>}
      <span className="z-list-item__content">{children}</span>
      {rightIcon && <span className="z-list-item__icon z-list-item__icon--right">{rightIcon}</span>}
    </button>
  );
}
