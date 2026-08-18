import type React from "react";
import { getFileIconUrl, getFolderIconUrl } from "@/base/browser/ui/icons/iconResolver";

interface InlineFileMentionProps {
  display: string;
  isDir?: boolean;
}

/** Shared visual representation of a file mention outside the editor DOM. */
export function InlineFileMention({ display, isDir = false }: InlineFileMentionProps): React.ReactElement {
  const label = display.replace(/^@/, "");
  const iconUrl = isDir ? getFolderIconUrl(label) : getFileIconUrl(label);

  return (
    <span className="inline-file-mention">
      <img className="inline-file-mention__icon" src={iconUrl} alt="" aria-hidden="true" draggable={false} />
      <span>{label}</span>
    </span>
  );
}
