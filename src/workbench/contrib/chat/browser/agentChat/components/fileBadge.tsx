import type React from "react";
import { FileIcon, FolderIcon } from "@/base/browser/ui/icons/fileIcons";
import type { FileBadgeInfo } from "@/workbench/services/agent/common/agentToolPresentation";

export function FileBadge({ info, onClick }: { info: FileBadgeInfo; onClick?: () => void }): React.ReactElement {
  const raw = info.rawPath;
  const display = !raw || raw === "." ? info.name : raw;
  return (
    <span
      className={`fbadge${onClick ? " fbadge--clickable" : ""}`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {info.cls === "dir" ? <FolderIcon open={false} name={info.name} /> : <FileIcon name={info.name} />}
      <span className="fbadge__name">{display}</span>
    </span>
  );
}
