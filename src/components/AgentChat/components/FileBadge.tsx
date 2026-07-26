import React from "react";
import { FileIcon, FolderIcon } from "../../Icons/file-icons.js";
import type { FileBadgeInfo } from "../utils.js";

export function FileBadge({ info }: { info: FileBadgeInfo }): React.ReactElement {
  const raw = info.rawPath;
  const display = !raw || raw === "." ? info.name : raw;
  return (
    <span className="fbadge">
      {info.cls === "dir" ? <FolderIcon open={false} name={info.name} /> : <FileIcon name={info.name} />}
      <span className="fbadge__name">{display}</span>
    </span>
  );
}
