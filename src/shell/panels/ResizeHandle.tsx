import type React from "react";
import { useCallback, useRef } from "react";

/** Drag-handle divider - directly manipulates the target element during drag,
 *  avoiding React re-renders. Only commits the final width to state on mouseup. */
export function ResizeHandle({
  targetRef,
  onCommit,
  minWidth = 0,
  maxWidth = Infinity,
  direction = "horizontal",
  forceHandleSide,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  onCommit: (size: number) => void;
  minWidth?: number;
  maxWidth?: number;
  direction?: "horizontal" | "vertical";
  /** Override auto-detection of which side the handle is on.
   *  "right" -> drag right/down grows target, drag left/up shrinks it (default behavior).
   *  "left"  -> drag right/down shrinks target, drag left/up grows it. */
  forceHandleSide?: "left" | "right";
}): React.ReactElement {
  const dragging = useRef(false);
  const last = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const el = targetRef.current;
      if (!el) return;

      dragging.current = true;
      last.current = direction === "horizontal" ? e.clientX : e.clientY;
      document.body.classList.add("is-resizing");
      if (direction === "vertical") {
        document.body.classList.add("is-resizing-vertical");
      }

      // Determine whether the handle sits at the left/top or right/bottom edge of the target
      // Uses center-position comparison to work for both sibling handles (outside target)
      // and child handles (inside target)
      const handleRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      const handleCx = (handleRect.left + handleRect.right) / 2;
      const targetCx = (targetRect.left + targetRect.right) / 2;
      const handleCy = (handleRect.top + handleRect.bottom) / 2;
      const targetCy = (targetRect.top + targetRect.bottom) / 2;
      const handleIsLeftOrTop =
        direction === "horizontal"
          ? forceHandleSide
            ? forceHandleSide === "left"
            : handleCx < targetCx
          : forceHandleSide
            ? forceHandleSide === "left"
            : handleCy < targetCy;

      function onMove(ev: MouseEvent) {
        if (!dragging.current) return;
        const cur = direction === "horizontal" ? ev.clientX : ev.clientY;
        const delta = cur - last.current;
        last.current = cur;

        const rect = el?.getBoundingClientRect();
        if (direction === "horizontal") {
          const newWidth = handleIsLeftOrTop ? (rect?.width ?? 0) - delta : (rect?.width ?? 0) + delta;
          if (el) {
            const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth));
            el.style.flex = `0 1 ${clamped}px`;
          }
        } else {
          const newHeight = handleIsLeftOrTop ? (rect?.height ?? 0) - delta : (rect?.height ?? 0) + delta;
          if (el) {
            const clamped = Math.max(minWidth, Math.min(maxWidth, newHeight));
            el.style.height = `${clamped}px`;
          }
        }
      }
      function onUp() {
        dragging.current = false;
        document.body.classList.remove("is-resizing");
        document.body.classList.remove("is-resizing-vertical");
        if (el) {
          const finalSize =
            direction === "horizontal" ? el.getBoundingClientRect().width : el.getBoundingClientRect().height;
          onCommit(Math.round(finalSize));
        }
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [targetRef, onCommit, minWidth, maxWidth, direction, forceHandleSide],
  );

  return <div className={`resize-handle resize-handle--${direction}`} onMouseDown={onMouseDown} aria-hidden="true" />;
}
