import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import "./ui.css";

export interface Option {
  value: string;
  label: string;
  fontFamily?: string;
}

export interface SelectProps {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onHover?: (value: string | null) => void;
  className?: string;
}

function getContainerRect() {
  // Try to find the closest scrolling container, or fallback to body/viewport
  const el = document.querySelector(".settings__container") || document.body;
  return el?.getBoundingClientRect() ?? null;
}

function getDropHeight(optionCount: number) {
  return Math.min(optionCount * 28 + 8, 148);
}

function clampDropdown(triggerRect: DOMRect, dropUp: boolean, dropHeight: number) {
  const containerRect = getContainerRect();
  if (!containerRect) {
    return {
      left: triggerRect.left,
      width: triggerRect.width,
      top: triggerRect.bottom,
      bottom: window.innerHeight - triggerRect.top,
    };
  }

  const left = Math.max(triggerRect.left, containerRect.left + 4);
  const width = Math.min(triggerRect.width, containerRect.right - 4 - left);

  let top: number;
  let bottom: number;

  if (dropUp) {
    bottom = window.innerHeight - triggerRect.top;
    const maxBottom = window.innerHeight - (containerRect.top + 4 + dropHeight);
    bottom = Math.min(bottom, maxBottom);
    top = window.innerHeight - bottom - dropHeight;
  } else {
    top = triggerRect.bottom;
    const maxTop = containerRect.bottom - 4 - dropHeight;
    top = Math.min(top, maxTop);
    bottom = window.innerHeight - top - dropHeight;
  }

  return { left, width, top, bottom };
}

function computeDropUp(r: DOMRect, optionCount: number) {
  const containerRect = getContainerRect();
  const dropHeight = getDropHeight(optionCount);
  const spaceBelow = containerRect ? containerRect.bottom - r.bottom : window.innerHeight - r.bottom;
  return spaceBelow < dropHeight + 8;
}

export function Select({ value, options, onChange, onHover, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const openDropdown = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropUp(computeDropUp(r, options.length));
    setRect(r);
    setOpen(true);
  }, [options.length]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
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

    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      const containerRect = getContainerRect();

      if (containerRect && (r.bottom < containerRect.top || r.top > containerRect.bottom)) {
        setOpen(false);
        return;
      }

      setDropUp(computeDropUp(r, options.length));
      setRect(r);
    };

    let parent = triggerRef.current?.parentElement;
    while (parent && parent !== document.body) {
      const { overflowY } = getComputedStyle(parent);
      if (overflowY === "auto" || overflowY === "scroll") {
        parent.addEventListener("scroll", update);
        break;
      }
      parent = parent.parentElement;
    }
    window.addEventListener("scroll", update, true);

    return () => {
      document.removeEventListener("mousedown", handler);
      if (parent && parent !== document.body) {
        parent.removeEventListener("scroll", update);
      }
      window.removeEventListener("scroll", update, true);
    };
  }, [open, options.length]);

  const selected = options.find((o) => o.value === value);

  const dropHeight = getDropHeight(options.length);
  const pos = rect ? clampDropdown(rect, dropUp, dropHeight) : null;

  const dropdown =
    open && pos
      ? createPortal(
          <div
            ref={wrapRef}
            className="ui-select-dropdown ui-select-dropdown--portal"
            style={{
              position: "fixed",
              left: pos.left,
              width: pos.width,
              ...(dropUp ? { bottom: pos.bottom, top: "auto" } : { top: pos.top, bottom: "auto" }),
              borderRadius: dropUp
                ? "var(--radius-sm, 4px) var(--radius-sm, 4px) 0 0"
                : "0 0 var(--radius-sm, 4px) var(--radius-sm, 4px)",
              borderTop: dropUp ? undefined : 0,
              borderBottom: dropUp ? 0 : undefined,
            }}
          >
            <div className="ui-select-dropdown-body">
              {options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`ui-select-item ${o.value === value ? "active" : ""}`}
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
    <div className={`ui-select ${className || ""}`.trim()}>
      <button
        ref={triggerRef}
        type="button"
        className="ui-select-trigger"
        onClick={() => (open ? setOpen(false) : openDropdown())}
        style={
          open
            ? {
                borderRadius: dropUp
                  ? "0 0 var(--radius-sm, 4px) var(--radius-sm, 4px)"
                  : "var(--radius-sm, 4px) var(--radius-sm, 4px) 0 0",
              }
            : undefined
        }
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
