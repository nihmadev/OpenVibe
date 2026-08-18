import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type React from "react";
import { useEffect, useRef, useState } from "react";

const MIN_DISPLAY_MS = 1000;
const SUMMARY_TRANSITION = { duration: 0.15, ease: "easeOut" } as const;

interface SummaryValue {
  key: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}

/** Codex cadence: live labels remain readable for at least one second. */
export function AnimatedSummary({
  contentKey,
  primary,
  secondary,
  enabled = true,
}: {
  contentKey: string;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  enabled?: boolean;
}): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const animate = enabled && !reducedMotion;
  const [shown, setShown] = useState<SummaryValue>(() => ({ key: contentKey, primary, secondary }));
  const shownAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<SummaryValue>({ key: contentKey, primary, secondary });
  latest.current = { key: contentKey, primary, secondary };

  useEffect(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);

    const now = performance.now();
    if (shownAt.current === null) shownAt.current = now;

    if (!animate) {
      setShown(latest.current);
      shownAt.current = now;
      timer.current = null;
      return;
    }

    if (shown.key === contentKey) return;
    const delay = Math.max(0, MIN_DISPLAY_MS - (now - shownAt.current));
    timer.current = window.setTimeout(() => {
      setShown(latest.current);
      shownAt.current = performance.now();
      timer.current = null;
    }, delay);
  }, [animate, contentKey, shown.key]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!animate) {
    return (
      <>
        {primary}
        {secondary}
      </>
    );
  }

  return (
    <span className="tool-summary-anim">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={shown.key}
          className="tool-summary-anim__inner"
          initial={{ y: "0.4em", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-0.4em", opacity: 0 }}
          transition={SUMMARY_TRANSITION}
        >
          {shown.primary}
          {shown.secondary}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
