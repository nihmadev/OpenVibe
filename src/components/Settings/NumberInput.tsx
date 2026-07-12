import React, { useRef, useEffect, useCallback } from "react";

interface NumberInputProps {
  value: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: string) => void;
}

export function NumberInput({ value, step, min, max, onChange }: NumberInputProps) {
  const num = parseFloat(value) || 0;
  const decRef = useRef<HTMLButtonElement>(null);
  const incRef = useRef<HTMLButtonElement>(null);

  const stepValue = useCallback(
    (dir: number) => {
      const next = Math.min(max, Math.max(min, num + step * dir));
      onChange(next.toFixed(2));
    },
    [num, step, min, max, onChange],
  );

  useEffect(() => {
    const dec = decRef.current;
    const inc = incRef.current;

    function onWheelDec(e: WheelEvent) {
      e.preventDefault();
      if (e.deltaY > 0) stepValue(-1);
      else if (e.deltaY < 0) stepValue(1);
    }
    function onWheelInc(e: WheelEvent) {
      e.preventDefault();
      if (e.deltaY > 0) stepValue(-1);
      else if (e.deltaY < 0) stepValue(1);
    }

    if (dec) dec.addEventListener("wheel", onWheelDec, { passive: false });
    if (inc) inc.addEventListener("wheel", onWheelInc, { passive: false });

    return () => {
      if (dec) dec.removeEventListener("wheel", onWheelDec);
      if (inc) inc.removeEventListener("wheel", onWheelInc);
    };
  }, [stepValue]);

  return (
    <div className="settings__number-input-wrap">
      <button
        ref={decRef}
        type="button"
        className="settings__number-btn"
        onClick={() => stepValue(-1)}
        disabled={num <= min}
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
      <input
        type="number"
        className="settings__number-input"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        ref={incRef}
        type="button"
        className="settings__number-btn"
        onClick={() => stepValue(1)}
        disabled={num >= max}
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}
