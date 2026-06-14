import React, { useEffect, useState } from "react";

interface RenameInputProps {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

export function RenameInput({ initial, onCommit, onCancel }: RenameInputProps): React.ReactElement {
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
    <input
      ref={ref}
      className="ftree__rename"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
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
  );
}
