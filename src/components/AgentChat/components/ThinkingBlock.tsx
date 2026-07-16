import React, { useEffect, useState, useRef, useCallback } from "react";
import { ChevronRightIcon } from "../../Icons/icons.js";
import { Markdown } from "../../Markdown/Markdown.js";

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (delay <= 0) {
      setDebounced(value);
      return;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export function ThinkingBlock({
  reasoning,
  reasoningDone,
}: {
  reasoning: string;
  reasoningDone?: boolean;
}): React.ReactElement {
  const displayReasoning = useDebouncedValue(reasoning, reasoningDone ? 0 : 50);
  const [open, setOpen] = useState(!reasoningDone);
  const [scrollState, setScrollState] = useState<"none" | "top" | "bottom" | "both">("none");
  const contentRef = useRef<HTMLDivElement>(null);
  const [durationStr, setDurationStr] = useState<string>("");
  const [liveDuration, setLiveDuration] = useState(0);
  const [startTime] = useState(() => Date.now());
  const prevReasoningDone = useRef(reasoningDone);

  useEffect(() => {
    if (reasoningDone && !prevReasoningDone.current) {
      const secs = Math.max(1, Math.round((Date.now() - startTime) / 1000));
      setDurationStr(`${secs}s`);
      setOpen(false);
    }
    prevReasoningDone.current = reasoningDone;
  }, [reasoningDone, startTime]);

  useEffect(() => {
    if (reasoningDone) return;
    const interval = setInterval(() => {
      setLiveDuration(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [reasoningDone, startTime]);

  const updateScroll = useCallback(() => {
    if (!contentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
    if (scrollHeight <= clientHeight) {
      setScrollState("none");
      return;
    }
    const isTop = scrollTop < 5;
    const isBottom = scrollHeight - scrollTop - clientHeight < 5;

    if (isTop && isBottom) setScrollState("none");
    else if (isTop) setScrollState("bottom");
    else if (isBottom) setScrollState("top");
    else setScrollState("both");
  }, []);

  useEffect(() => {
    updateScroll();
  }, [displayReasoning, open, updateScroll]);

  useEffect(() => {
    if (!reasoningDone && contentRef.current) {
      const el = contentRef.current;
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
      if (isNearBottom) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [displayReasoning, reasoningDone]);

  const maskClass = scrollState === "none" ? "" : `thinking-mask-${scrollState}`;

  return (
    <div className="thinking-block">
      <div
        className={`thinking-header${!reasoningDone ? " thinking-header--pending" : ""}`}
        onClick={() => setOpen(!open)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className="thinking-header__text">
          {!reasoningDone
            ? `Thinking...${liveDuration > 0 ? ` ${liveDuration}s` : ""}`
            : durationStr
              ? `Thought for ${durationStr}`
              : "Thought"}
        </span>
        <span className="thinking-header__icon">
          <ChevronRightIcon open={open} />
        </span>
      </div>

      {open && (
        <div className={`thinking-content-wrapper ${maskClass}`}>
          <div className="thinking-content" ref={contentRef} onScroll={updateScroll}>
            <Markdown content={displayReasoning} isAssistant={true} simplifiedCodeBlocks={true} noFileIcons={true} />
          </div>
        </div>
      )}
    </div>
  );
}
