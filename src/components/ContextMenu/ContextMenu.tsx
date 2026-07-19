import React, { useEffect, useRef } from "react";
import "./ContextMenu.css";

export interface MenuItem {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  checked?: boolean;
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
    const viewportGap = 8;
    const left = Math.min(Math.max(x, viewportGap), window.innerWidth - r.width - viewportGap);
    const top = Math.min(Math.max(y, viewportGap), window.innerHeight - r.height - viewportGap);

    el.style.left = `${Math.max(viewportGap, left)}px`;
    el.style.top = `${Math.max(viewportGap, top)}px`;

    el.querySelector<HTMLButtonElement>(".ctxmenu__item:not(:disabled)")?.focus({ preventScroll: true });
  }, [x, y]);

  const hasLeadingVisual = items.some((item) => item.icon || item.checked !== undefined);

  function onMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;

    const enabledItems = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>(".ctxmenu__item:not(:disabled)") ?? [],
    );
    if (enabledItems.length === 0) return;

    e.preventDefault();
    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number;

    if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = enabledItems.length - 1;
    else if (e.key === "ArrowDown") nextIndex = (currentIndex + 1) % enabledItems.length;
    else nextIndex = (currentIndex - 1 + enabledItems.length) % enabledItems.length;

    enabledItems[nextIndex]?.focus();
  }

  return (
    <div className="ctxmenu" style={style} ref={ref} role="menu" onKeyDown={onMenuKeyDown}>
      {items.map((item, i) => {
        if (!item.label) return <div className="ctxmenu__separator" role="separator" key={`separator-${i}`} />;

        return (
          <button
            key={`${item.label}-${i}`}
            className={"ctxmenu__item" + (item.danger ? " ctxmenu__item--danger" : "")}
            type="button"
            role={item.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
            aria-checked={item.checked !== undefined ? item.checked : undefined}
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onClose();
            }}
          >
            {hasLeadingVisual ? (
              <span className="ctxmenu__leading" aria-hidden="true">
                {item.checked !== undefined ? (
                  <span className={`ctxmenu__check ${item.checked ? "ctxmenu__check--on" : ""}`}>
                    {item.checked ? "✓" : ""}
                  </span>
                ) : item.icon ? (
                  <span className="ctxmenu__icon">{item.icon}</span>
                ) : null}
              </span>
            ) : null}
            <span className="ctxmenu__label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
