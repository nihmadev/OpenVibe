import React from "react";
import { FileIcon, FolderIcon } from "../../Icons/file-icons.js";
import type { FileBadgeInfo } from "../utils.js";

export function FileBadge({ info }: { info: FileBadgeInfo }): React.ReactElement {
  const display = info.rawPath ?? info.name;
  return (
    <span className="fbadge">
      {info.cls === "dir" ? <FolderIcon open={false} name={info.name} /> : <FileIcon name={info.name} />}
      <span className="fbadge__name">{display}</span>
    </span>
  );
}
