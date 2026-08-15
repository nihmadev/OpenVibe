import type React from "react";
import type { FileGroupEntry } from "@/features/files/model/fs";
import { ChevronRightIcon, FileIcon } from "@/shared/icons";
import { interactiveItemClassName } from "@/shared/ui/kit";

export interface SearchFileGroupProps {
  entry: FileGroupEntry;
  collapsed: boolean;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
}

export function SearchFileGroup({
  entry,
  collapsed,
  isSelected,
  onClick,
  onMouseEnter,
}: SearchFileGroupProps): React.ReactElement {
  return (
    <div
      className={interactiveItemClassName(isSelected, `sc-file-header${isSelected ? " sc-file-header--selected" : ""}`)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span className="sc-chev">
        <ChevronRightIcon open={!collapsed} />
      </span>
      <FileIcon name={entry.name} />
      <span className="sc-file-name">{entry.name}</span>
      <span className="sc-file-path">{entry.rel}</span>
      <span className="sc-match-badge">{entry.matchCount}</span>
    </div>
  );
}
