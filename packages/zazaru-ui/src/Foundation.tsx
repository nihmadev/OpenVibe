import * as React from "react";

function classes(...values: Array<string | undefined | false>): string { return values.filter(Boolean).join(" "); }

export const Box: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLDivElement> & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Box({ className, ...props }, ref) {
  return <div ref={ref} className={classes("z-box", className)} {...props} />;
});

export interface LayoutProps extends React.HTMLAttributes<HTMLDivElement> { gap?: "1" | "2" | "3" | "4" | "6" | "8"; align?: "start" | "center" | "end" | "stretch"; }
export const Stack: React.ForwardRefExoticComponent<LayoutProps & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, LayoutProps>(function Stack({ className, gap = "4", align, style, ...props }, ref) {
  return <div ref={ref} className={classes("z-stack", align && `z-align-${align}`, className)} style={{ "--z-layout-gap": `var(--z-space-${gap})`, ...style } as React.CSSProperties} {...props} />;
});
export const Inline: React.ForwardRefExoticComponent<LayoutProps & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, LayoutProps>(function Inline({ className, gap = "4", align = "center", style, ...props }, ref) {
  return <div ref={ref} className={classes("z-inline", `z-align-${align}`, className)} style={{ "--z-layout-gap": `var(--z-space-${gap})`, ...style } as React.CSSProperties} {...props} />;
});
export interface GridProps extends LayoutProps { columns?: number | string; minColumnWidth?: string; }
export const Grid: React.ForwardRefExoticComponent<GridProps & React.RefAttributes<HTMLDivElement>> = React.forwardRef<HTMLDivElement, GridProps>(function Grid({ className, gap = "4", columns, minColumnWidth = "12rem", style, ...props }, ref) {
  const template = columns ? (typeof columns === "number" ? `repeat(${columns}, minmax(0, 1fr))` : columns) : `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}), 1fr))`;
  return <div ref={ref} className={classes("z-grid", className)} style={{ "--z-layout-gap": `var(--z-space-${gap})`, gridTemplateColumns: template, ...style } as React.CSSProperties} {...props} />;
});

export const Separator: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLHRElement> & React.RefAttributes<HTMLHRElement>> = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(function Separator({ className, ...props }, ref) { return <hr ref={ref} className={classes("z-separator", className)} {...props} />; });
export const Text: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLSpanElement> & { muted?: boolean } & React.RefAttributes<HTMLSpanElement>> = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { muted?: boolean }>(function Text({ className, muted, ...props }, ref) { return <span ref={ref} className={classes("z-text", muted && "z-text--muted", className)} {...props} />; });
export const Heading: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 | 4 } & React.RefAttributes<HTMLHeadingElement>> = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement> & { level?: 1 | 2 | 3 | 4 }>(function Heading({ level = 2, className, ...props }, ref) { return React.createElement(`h${level}`, { ref, className: classes("z-heading", `z-heading--${level}`, className), ...props }); });
export const Code: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>> = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function Code({ className, ...props }, ref) { return <code ref={ref} className={classes("z-code", className)} {...props} />; });
export const Kbd: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLElement> & React.RefAttributes<HTMLElement>> = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function Kbd({ className, ...props }, ref) { return <kbd ref={ref} className={classes("z-kbd", className)} {...props} />; });
export const VisuallyHidden: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLSpanElement> & React.RefAttributes<HTMLSpanElement>> = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(function VisuallyHidden({ className, ...props }, ref) { return <span ref={ref} className={classes("z-visually-hidden", className)} {...props} />; });

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> { size?: "sm" | "md" | "lg"; label?: string; }
export const Spinner: React.ForwardRefExoticComponent<SpinnerProps & React.RefAttributes<HTMLSpanElement>> = React.forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner({ size = "md", label = "Loading", className, ...props }, ref) {
  return <span ref={ref} role="status" aria-label={label} className={classes("z-spinner", `z-spinner--${size}`, className)} {...props}><VisuallyHidden>{label}</VisuallyHidden></span>;
});
