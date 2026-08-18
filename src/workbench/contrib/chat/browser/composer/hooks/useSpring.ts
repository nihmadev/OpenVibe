import type React from "react";
import { useEffect, useState } from "react";

/** Maps a 0..1 animation value to fade/scale/blur CSS properties. */
export function motion(value: number): React.CSSProperties {
  return {
    opacity: value,
    transform: `scale(${0.98 + value * 0.02})`,
    filter: `blur(${(1 - value) * 2}px)`,
    pointerEvents: value > 0.5 ? "auto" : ("none" as React.CSSProperties["pointerEvents"]),
  };
}

/** Animates `target` with an eased 200ms tween instead of CSS transitions. */
export function useSpring(target: number, deps: React.DependencyList) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    const start = value;
    const diff = target - start;
    if (Math.abs(diff) < 0.01) {
      setValue(target);
      return;
    }
    const duration = 200;
    const startTime = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setValue(start + diff * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // biome-ignore lint/correctness/useExhaustiveDependencies: deps forwarded from caller
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}
