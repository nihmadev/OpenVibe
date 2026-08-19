import { Loader as LoaderIcon } from "lucide-react";
import type React from "react";
import "./loader.css";

export interface LoaderProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: number;
}

export function Loader({ className, size = 18, ...props }: LoaderProps): React.ReactElement {
  const classes = ["ui-loader", className].filter(Boolean).join(" ");

  return (
    <span className={classes} role="status" aria-label="Loading" {...props}>
      <LoaderIcon width={size} height={size} aria-hidden="true" />
    </span>
  );
}
