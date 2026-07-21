import React, { useCallback, useEffect, useRef, useState } from "react";
import { Lightbulb } from "lucide-react";
import { useI18n } from "../../../hooks/useI18n.js";

interface EffortOption {
  value: string;
  labelKey: string;
}

interface ReasoningEffortSelectorProps {
  currentEffort: string | undefined;
  onChange: (effort: string | null) => void;
  effortOptions: EffortOption[];
}

export function ReasoningEffortSelector({ currentEffort, onChange, effortOptions }: ReasoningEffortSelectorProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (selRef.current && !selRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open]);

  if (effortOptions.length === 0) return null;

  const activeLabel = currentEffort
    ? (effortOptions.find((o) => o.value === currentEffort)?.labelKey ?? currentEffort)
    : effortOptions[0].labelKey;
  const activeText = t(activeLabel);

  return (
    <div className="reasoning-effort-selector" ref={selRef}>
      <button type="button" className="reasoning-effort-selector__trigger" onClick={() => setOpen((v) => !v)}>
        <Lightbulb size={14} />
        <span className="reasoning-effort-selector__trigger-name">{activeText}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="reasoning-effort-selector__popup">
          {effortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={
                "reasoning-effort-selector__item" +
                ((currentEffort ?? "") === opt.value ? " reasoning-effort-selector__item--active" : "")
              }
              onClick={() => {
                onChange(opt.value || null);
                setOpen(false);
              }}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
