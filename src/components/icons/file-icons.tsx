import React from "react";
import { getFileIcon, getFolderIcon } from "./utils.js";

export function FolderIcon({ open, name }: { open: boolean; name?: string }): React.ReactElement {
  const folderIcon = getFolderIcon(name, open);
  return (
    <img
      className="ftree__img"
      src={`icons/symbols/folders/${folderIcon}`}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ width: 16, height: 16 }}
    />
  );
}

export function FileIcon({ name }: { name?: string }): React.ReactElement {
  const icon = name ? getFileIcon(name) : null;
  if (icon) {
    return (
      <img
        className="ftree__img"
        src={`icons/symbols/files/${icon}`}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={{ width: 16, height: 16 }}
      />
    );
  }
  return (
    <img
      className="ftree__img"
      src="icons/symbols/files/document.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{ width: 16, height: 16 }}
    />
  );
}
