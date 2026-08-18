import type React from "react";

export function GitIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M4.5 1a2.5 2.5 0 0 1 1.99 4.01 7.5 7.5 0 0 1 3.47 1.5 7.5 7.5 0 0 1 2.53 3.47A2.5 2.5 0 1 1 10 11.17a6.5 6.5 0 0 0-2.08-2.84A6.5 6.5 0 0 0 5.5 6.5V5.01A2.5 2.5 0 0 1 4.5 1zM4.5 3a1 1 0 1 0 0 2 1 1 0 1 0 0-2zM11 12a1 1 0 1 0 0 2 1 1 0 1 0 0-2z" />
      <path d="M3.5 5.5v6.628a2.25 2.25 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0z" />
    </svg>
  );
}

export function GitBranchIcon({
  size = 16,
  className,
}: {
  size?: number | string;
  className?: string;
} = {}): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M11.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-2.25.75a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25zM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5z"
      />
    </svg>
  );
}

export function GitRepoIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8A1.5 1.5 0 0 0 3 11.5h.5a.75.75 0 0 1 0 1.5H3a.5.5 0 0 0 .5.5h1.75a.75.75 0 0 1 0 1.5H2.5a.5.5 0 0 1-.5-.5v-12zm10.5 1.5h-8A1.5 1.5 0 0 0 3 5.5v5.3A2.49 2.49 0 0 1 4.5 10h8V4z"
      />
    </svg>
  );
}

export function GitCommitIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="evenodd" d="M8 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

export function GitPullRequestIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M7.177 3.073L9.573.677A.25.25 0 0 1 10 .854v4.792a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354zM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-1.5.75a1.5 1.5 0 1 1 2.905.422l3.928 4.5a1.5 1.5 0 1 1-.587.577L4.57 4.25a1.5 1.5 0 0 1-2.32-1zm5.5 8.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5zm-1.5.75a1.5 1.5 0 1 1 2.953.328l2.31 2.437a.75.75 0 0 1-1.086 1.03L9.667 13.06a1.5 1.5 0 0 1-2.417-.56z"
      />
    </svg>
  );
}

export function GitStashIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M4.5 1.5A2.5 2.5 0 0 0 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4V2h8v1h-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V4a2.5 2.5 0 0 0-2.5-2.5h-7z"
      />
      <path fillRule="evenodd" d="M8 13.5a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1a.5.5 0 0 1 .5-.5z" />
      <path
        fillRule="evenodd"
        d="M5.5 11.5A1.5 1.5 0 0 1 7 13v1a.5.5 0 0 0 1 0v-1a1.5 1.5 0 0 1 1.5-1.5h1.793l-1.147-1.146a.5.5 0 0 1 .708-.708l2 2a.5.5 0 0 1 0 .708l-2 2a.5.5 0 0 1-.708-.708L11.293 12H9.5a.5.5 0 0 0-.5.5v1A1.5 1.5 0 0 1 7.5 15h-1A1.5 1.5 0 0 1 5 13.5v-1a.5.5 0 0 0-.5-.5H2V4a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5z"
      />
    </svg>
  );
}

export function GitCircleOutlineIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function EllipsisIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <circle cx="4" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="12" cy="8" r="1.5" />
    </svg>
  );
}

export function OpenFileIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 1h5l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1z" />
      <polyline points="9 1 9 4 12 4" />
    </svg>
  );
}

export function DiscardIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 7.5a6.5 6.5 0 1 1 0 4.5" />
    </svg>
  );
}

export function StageIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 1 8 15" />
      <polyline points="1 8 8 1 15 8" />
    </svg>
  );
}

export function UnstageIcon(): React.ReactElement {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="8 1 8 15" />
      <polyline points="15 8 8 15 1 8" />
    </svg>
  );
}

export function RepoBookIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8A1.5 1.5 0 0 0 3 11.5h.5a.75.75 0 0 1 0 1.5H3a.5.5 0 0 0 .5.5h1.75a.75.75 0 0 1 0 1.5H2.5a.5.5 0 0 1-.5-.5v-12zm10.5 8V1.5h-8A.5.5 0 0 0 4 2v8.3a2.5 2.5 0 0 1 .5-.3h8zM4 12.5a.5.5 0 0 0 0 1h8.5a.5.5 0 0 0 0-1H4z"
      />
    </svg>
  );
}

export function CommitGitIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="4.5" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" />
    </svg>
  );
}

export function GraphIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="4" cy="4" r="2" />
      <circle cx="4" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <line x1="4" y1="6" x2="4" y2="10" />
      <line x1="6" y1="4" x2="10" y2="4" />
      <line x1="10" y1="12" x2="4" y2="12" />
    </svg>
  );
}

export function ChangesIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}
