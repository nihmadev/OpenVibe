import { useEffect, useRef, useState } from "react";

/**
 * useScrollMask
 * Applies dynamic top/bottom gradient masks to a scroll container when content overflows,
 * providing the authentic clean fade effect at the boundaries.
 */
export function useScrollMask<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [hasTopMask, setHasTopMask] = useState(false);
  const [hasBottomMask, setHasBottomMask] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateMasks = () => {
      const isOverflowing = el.scrollHeight > el.clientHeight + 1;
      const isAtTop = el.scrollTop <= 1;
      const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;

      setHasTopMask(isOverflowing && !isAtTop);
      setHasBottomMask(isOverflowing && !isAtBottom);
    };

    updateMasks();

    const handleScroll = () => {
      updateMasks();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateMasks);
      resizeObserver.observe(el);
      if (el.firstElementChild) {
        resizeObserver.observe(el.firstElementChild);
      }
    }

    return () => {
      el.removeEventListener("scroll", handleScroll);
      resizeObserver?.disconnect();
    };
  }, []);

  const maskStyle: React.CSSProperties = (() => {
    if (!hasTopMask && !hasBottomMask) return {};
    const topFade = hasTopMask ? "transparent 0px, black 24px" : "black 0px, black 24px";
    const bottomFade = hasBottomMask
      ? "black calc(100% - 24px), transparent 100%"
      : "black calc(100% - 24px), black 100%";
    const gradient = `linear-gradient(to bottom, ${topFade}, ${bottomFade})`;

    return {
      WebkitMaskImage: gradient,
      maskImage: gradient,
      WebkitMaskRepeat: "no-repeat",
      maskRepeat: "no-repeat",
      WebkitMaskSize: "100% 100%",
      maskSize: "100% 100%",
    };
  })();

  return { ref, maskStyle, hasTopMask, hasBottomMask };
}
