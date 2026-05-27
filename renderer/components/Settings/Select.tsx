import React, { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onHover?: (value: string | null) => void;
}

export function Select({ value, options, onChange, onHover }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="settings__custom-select" ref={ref}>
      <button
        type="button"
        className="settings__custom-select-trigger"
        onClick={() => setOpen(!open)}
      >
        <span>{selected?.label ?? value}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="settings__custom-select-dropdown">
          <div className="settings__custom-select-dropdown-body">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`settings__custom-select-item ${o.value === value ? "active" : ""}`}
              onMouseEnter={() => onHover?.(o.value)}
              onMouseLeave={() => onHover?.(null)}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
