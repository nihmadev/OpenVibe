import type React from "react";

export function MinimizeIcon(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M1 5h8" />
    </svg>
  );
}

export function MaximizeIcon(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      <rect x="1" y="1" width="8" height="8" />
    </svg>
  );
}

export function CloseIcon(): React.ReactElement {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M1 1l8 8M9 1l-8 8" />
    </svg>
  );
}
