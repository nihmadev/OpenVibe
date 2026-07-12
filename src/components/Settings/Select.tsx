import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
  fontFamily?: string;
}

interface SelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onHover?: (value: string | null) => void;
}

export function Select({ value, options, onChange, onHover }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const openDropdown = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const dropHeight = Math.min(options.length * 28 + 8, 148);
    setDropUp(spaceBelow < dropHeight + 8);
    setRect(r);
    setOpen(true);
  }, [options.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // close if click outside both trigger and dropdown
      const target = e.target as Node;
      if (
        wrapRef.current &&
        !wrapRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const dropdown =
    open && rect
      ? createPortal(
          <div
            ref={wrapRef}
            className="settings__custom-select-dropdown settings__custom-select-dropdown--portal"
            style={{
              position: "fixed",
              left: rect.left,
              width: rect.width,
              ...(dropUp
                ? { bottom: window.innerHeight - rect.top, top: "auto" }
                : { top: rect.bottom, bottom: "auto" }),
              borderRadius: dropUp ? "var(--radius-md) var(--radius-md) 0 0" : "0 0 var(--radius-md) var(--radius-md)",
              borderTop: dropUp ? undefined : 0,
              borderBottom: dropUp ? 0 : undefined,
            }}
          >
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
                  style={o.fontFamily ? { fontFamily: o.fontFamily } : undefined}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="settings__custom-select">
      <button
        ref={triggerRef}
        type="button"
        className="settings__custom-select-trigger"
        onClick={() => (open ? setOpen(false) : openDropdown())}
      >
        <span>{selected?.label ?? value}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 0.15s" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {dropdown}
    </div>
  );
}
