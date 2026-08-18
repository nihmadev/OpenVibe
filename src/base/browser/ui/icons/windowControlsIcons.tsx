import type React from "react";

export function MinimizeIcon({
  size = 10,
  className,
}: {
  size?: number | string;
  className?: string;
} = {}): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 5h8" />
    </svg>
  );
}

export function MaximizeIcon({
  size = 10,
  className,
}: {
  size?: number | string;
  className?: string;
} = {}): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      aria-hidden="true"
    >
      <rect x="1" y="1" width="8" height="8" />
    </svg>
  );
}

export function CloseIcon({
  size = 10,
  className,
}: {
  size?: number | string;
  className?: string;
} = {}): React.ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      aria-hidden="true"
    >
      <path d="M1 1l8 8M9 1l-8 8" />
    </svg>
  );
}
