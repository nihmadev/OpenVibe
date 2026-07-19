import React, { useRef, useState, useCallback, useEffect } from "react";
import "./AgentChat.css";
import "./FBadge.css";

import { Props } from "./types.js";
import { UserMessageActions } from "./components/UserMessageActions.js";
import { AgentRun } from "./components/AgentRun.js";
import { Markdown } from "../Markdown/Markdown.js";
import { HistoryItem } from "./types.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useI18n } from "../../hooks/useI18n.js";
import { buildChatEntries } from "./agentRunModel.js";
import { Check } from "lucide-react";
import { ErrorNotice } from "./components/ErrorNotice.js";

// Re-export types for backward compatibility
export type { AttachmentView, HistoryItem, Props } from "./types.js";

const StandaloneItem = React.memo(
  ({
    item,
    onPickModel,
    onRevert,
  }: {
    item: HistoryItem;
    onPickModel?: (id: string) => void;
    onRevert?: (id: string) => void;
  }) => {
    const { t } = useI18n();

    if (item.kind === "model-picker" && item.models) {
      return (
        <div className="modelpicker">
          <div className="modelpicker__title">{t("selectModel")}</div>
          {item.models.map((m) => (
            <button
              key={m.id}
              className={"modelpicker__item" + (m.id === item.currentModel ? " modelpicker__item--active" : "")}
              onClick={() => onPickModel?.(m.id)}
            >
              <span className="modelpicker__name">{m.name}</span>
              <span className="modelpicker__id">{m.id}</span>
              <span className="modelpicker__check">
                <Check size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (item.kind === "user") {
      return (
        <div className="msg msg--user-wrap">
          <div className="msg msg--user">
            <Markdown content={item.text} isAssistant={false} />
          </div>
          <UserMessageActions item={item} onRevert={onRevert} />
          {item.attachments && item.attachments.length > 0 ? (
            <div className="msg__attachments">
              {item.attachments.map((a) =>
                a.kind === "image" && a.dataUrl ? (
                  <Tooltip key={a.id} text={a.name}>
                    <img className="msg__image" src={a.dataUrl} alt={a.name} />
                  </Tooltip>
                ) : (
                  <Tooltip key={a.id} text={a.path ?? a.name}>
                    <span className="msg__file">
                      <span className="msg__file-icon">⌘</span>
                      {a.name}
                    </span>
                  </Tooltip>
                ),
              )}
            </div>
          ) : null}
        </div>
      );
    }

    if (item.kind === "error") return <ErrorNotice text={item.text} />;
    return <div className={`msg msg--${item.kind}`}>{item.text}</div>;
  },
  (prev, next) => {
    if (prev.onPickModel !== next.onPickModel) return false;
    if (prev.onRevert !== next.onRevert) return false;
    if (prev.item.text !== next.item.text) return false;
    if (prev.item.attachments !== next.item.attachments) return false;
    if (prev.item.models !== next.item.models) return false;
    if (prev.item.currentModel !== next.item.currentModel) return false;
    return true;
  },
);

export function AgentChat({
  items,
  onPickModel,
  onRegenerate,
  onRevert,
  onDrillDown,
  streamingId,
  busy,
  cwd,
}: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpMetrics, setJumpMetrics] = useState({ duration: 800, dist: 10 });
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    window.vibe.state.get("settings:showThinking").then((val) => {
      if (val !== null) setShowThinking(val === "true");
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const chatEntries = React.useMemo(() => buildChatEntries(items ?? []), [items]);
  const lastRunId = React.useMemo(
    () => [...chatEntries].reverse().find((entry) => entry.kind === "run")?.id,
    [chatEntries],
  );

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const isFarFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight > 150;
    setShowScrollDown(isFarFromBottom);
  }, []);

  const handleManualInterrupt = useCallback(() => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
      scrollRafRef.current = null;
      setIsJumping(false);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);

    const startScrollTop = el.scrollTop;
    const targetScrollTop = el.scrollHeight - el.clientHeight;
    const distance = Math.max(0, targetScrollTop - startScrollTop);

    if (distance <= 5) {
      el.scrollTop = targetScrollTop;
      handleScroll();
      return;
    }

    const duration = Math.min(Math.max(450, Math.round(distance * 0.35 + 250)), 1100);
    const dist = Math.min(Math.max(7, Math.round(distance / 250 + 6)), 14);

    setJumpMetrics({ duration, dist });
    setIsJumping(true);

    const startTime = performance.now();
    const animateScroll = (currentTime: number) => {
      const currentEl = ref.current;
      if (!currentEl) return;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentTarget = currentEl.scrollHeight - currentEl.clientHeight;
      currentEl.scrollTop = startScrollTop + (currentTarget - startScrollTop) * ease;

      if (progress < 1) {
        scrollRafRef.current = requestAnimationFrame(animateScroll);
      } else {
        currentEl.scrollTop = currentTarget;
        scrollRafRef.current = null;
        setIsJumping(false);
        handleScroll();
      }
    };

    scrollRafRef.current = requestAnimationFrame(animateScroll);
  }, [handleScroll]);

  const handleAnimationEnd = useCallback((e: React.AnimationEvent<HTMLButtonElement>) => {
    if (e.target === e.currentTarget && !scrollRafRef.current) {
      setIsJumping(false);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) el.scrollTop = el.scrollHeight;
    handleScroll();
  }, [items, busy, handleScroll]);

  return (
    <div className="chathistory-wrapper">
      <div
        className="chathistory-container"
        ref={ref}
        onScroll={handleScroll}
        onWheel={handleManualInterrupt}
        onPointerDown={handleManualInterrupt}
      >
        {chatEntries.map((entry) => {
          if (entry.kind === "run") {
            return (
              <AgentRun
                key={entry.id}
                items={entry.items}
                finalItem={entry.finalItem}
                allItems={items}
                isActive={!!busy && entry.id === lastRunId}
                isFinalStreaming={entry.finalItem?.id === streamingId}
                showThinking={showThinking}
                cwd={cwd}
                onRegenerate={onRegenerate}
                onDrillDown={onDrillDown}
              />
            );
          }
          return <StandaloneItem key={entry.item.id} item={entry.item} onPickModel={onPickModel} onRevert={onRevert} />;
        })}

        {busy && !lastRunId && <AgentRun items={[]} allItems={items} isActive showThinking={showThinking} cwd={cwd} />}
      </div>
      {(showScrollDown || isJumping) && (
        <button
          className={`scroll-down-btn ${isJumping ? "scroll-down-btn--jumping" : ""}`}
          style={
            isJumping
              ? ({
                  "--jump-duration": `${jumpMetrics.duration}ms`,
                  "--jump-dist": `${jumpMetrics.dist}px`,
                } as React.CSSProperties)
              : undefined
          }
          onClick={scrollToBottom}
          onAnimationEnd={handleAnimationEnd}
          aria-label="Scroll to bottom"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="scroll-arrow-svg"
          >
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );
}
