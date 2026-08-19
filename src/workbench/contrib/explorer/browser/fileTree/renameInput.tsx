import { Input } from "@zazaru/ui";
import React, { useEffect, useState } from "react";
import { FileIcon, FolderIcon } from "@/base/browser/ui/icons/iconRegistry";

interface RenameInputProps {
  initial: string;
  kind: "file" | "dir";
  folderOpen?: boolean;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

export function RenameInput({
  initial,
  kind,
  folderOpen = false,
  onCommit,
  onCancel,
}: RenameInputProps): React.ReactElement {
  const [value, setValue] = useState(initial);
  const ref = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const dot = initial.lastIndexOf(".");
    el.setSelectionRange(0, dot > 0 ? dot : initial.length);
  }, [initial]);

  return (
    <div className="ftree__rename-control" onClick={(e) => e.stopPropagation()}>
      <Input
        ref={ref}
        size="sm"
        className="ftree__rename"
        containerClassName="ftree__rename-wrap"
        icon={kind === "dir" ? <FolderIcon open={folderOpen} name={value.trim()} /> : <FileIcon name={value.trim()} />}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (value.trim() && value !== initial) onCommit(value.trim());
            else onCancel();
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => {
          if (value.trim() && value !== initial) onCommit(value.trim());
          else onCancel();
        }}
        spellCheck={false}
      />
    </div>
  );
}
