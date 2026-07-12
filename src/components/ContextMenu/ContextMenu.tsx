import React, { useEffect, useRef } from "react";
import "../../styles/ContextMenu.css";

export interface MenuItem {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDown(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const style: React.CSSProperties = { left: x, top: y };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.right > window.innerWidth) el.style.left = `${window.innerWidth - r.width - 4}px`;
    if (r.bottom > window.innerHeight) el.style.top = `${window.innerHeight - r.height - 4}px`;
  }, [x, y]);

  return (
    <div className="ctxmenu" style={style} ref={ref}>
      {items.map((item, i) => (
        <button
          key={item.label ?? i}
          className={
            "ctxmenu__item" +
            (item.danger ? " ctxmenu__item--danger" : "") +
            (item.disabled ? " ctxmenu__item--disabled" : "")
          }
          disabled={item.disabled}
          onClick={() => {
            item.onClick?.();
            onClose();
          }}
        >
          {item.icon ? <span className="ctxmenu__icon">{item.icon}</span> : null}
          {item.label}
        </button>
      ))}
    </div>
  );
}
