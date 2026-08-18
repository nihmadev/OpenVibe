import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual";
import React, { useCallback, useEffect, useRef, useState } from "react";
import "./chatView.css";
import "./fileBadge.css";

import { recipeSurfaceClassName } from "@zazaru/ui/recipes";
import { FileIcon } from "@/base/browser/ui/icons/fileIcons";
import { CheckStrokeIcon } from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useI18n } from "@/platform/localization/localizationService";
import { appState } from "@/platform/storage/common/keyValueStore";
import { buildChatEntries } from "../../../../services/agent/common/agentRun";
import type { ChatViewProps, HistoryItem } from "../../common/chat";
import { AgentRun } from "../agentChat/components/agentRun";
import { ChatHistoryRail } from "../agentChat/components/chatHistoryRail";
import { ErrorNotice } from "../agentChat/components/errorNotice";
import { UserMessageActions } from "../agentChat/components/userMessageActions";
import { UserMessageContent } from "../agentChat/components/userMessageContent";

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
        <div className="modelpicker" role="radiogroup" aria-label={t("selectModel")}>
          <div className="modelpicker__title">{t("selectModel")}</div>
          {item.models.map((m) => (
            <button
              key={m.id}
              className="modelpicker__item"
              role="radio"
              aria-checked={m.id === item.currentModel}
              onClick={() => onPickModel?.(m.id)}
            >
              <span className="modelpicker__name">{m.name}</span>
              <span className="modelpicker__id">{m.id}</span>
              <span className="modelpicker__check">
                <CheckStrokeIcon size={14} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      );
    }

    if (item.kind === "user") {
      return (
        <div className="msg msg--user-wrap">
          <div className={recipeSurfaceClassName("bubble", "msg msg--user")}>
            <UserMessageContent text={item.text} mentions={item.mentions} />
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
                      <span className="msg__file-icon">
                        <FileIcon name={a.name} />
                      </span>
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
    if (prev.item.mentions !== next.item.mentions) return false;
    if (prev.item.models !== next.item.models) return false;
    if (prev.item.currentModel !== next.item.currentModel) return false;
    return true;
  },
);

export function ChatView({
  items,
  onPickModel,
  onRegenerate,
  onRevert,
  onDrillDown,
  onOpenAgentDiff,
  streamingId,
  busy,
  cwd,
}: ChatViewProps): React.ReactElement {
  const ref = useRef<HTMLDivElement | null>(null);
  const [showThinking, setShowThinking] = useState(true);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [isJumping, setIsJumping] = useState(false);
  const [jumpMetrics, setJumpMetrics] = useState({ duration: 800, dist: 10 });
  const scrollRafRef = useRef<number | null>(null);
  const followRafRef = useRef<number | null>(null);
  const shouldFollowBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);

  useEffect(() => {
    let changed = false;
    const handleSettingsChanged = (event: Event) => {
      const { key, value } = (event as CustomEvent<{ key?: string; value?: unknown }>).detail ?? {};
      if (key === "showThinking") {
        changed = true;
        setShowThinking(value === true || value === "true");
      }
    };
    window.addEventListener("vibe:settings-changed", handleSettingsChanged);
    appState.get("settings:showThinking").then((val) => {
      if (!changed && val !== null) setShowThinking(val === "true");
    });
    return () => {
      window.removeEventListener("vibe:settings-changed", handleSettingsChanged);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      if (followRafRef.current) cancelAnimationFrame(followRafRef.current);
    };
  }, []);

  const chatEntries = React.useMemo(() => buildChatEntries(items ?? []), [items]);
  const lastRunId = React.useMemo(
    () => [...chatEntries].reverse().find((entry) => entry.kind === "run")?.id,
    [chatEntries],
  );
  const pendingOnly = !!busy && !lastRunId;
  const virtualCount = chatEntries.length + (pendingOnly ? 1 : 0);
  const activeRunIndex = React.useMemo(
    () => (busy && lastRunId ? chatEntries.findIndex((entry) => entry.kind === "run" && entry.id === lastRunId) : -1),
    [busy, chatEntries, lastRunId],
  );

  const virtualizer = useVirtualizer({
    count: virtualCount,
    getScrollElement: () => ref.current,
    estimateSize: () => 220,
    getItemKey: (index) => {
      const entry = chatEntries[index];
      if (!entry) return "pending-run";
      return entry.kind === "run" ? entry.id : entry.item.id;
    },
    overscan: 6,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      if (activeRunIndex >= 0 && !indexes.includes(activeRunIndex)) indexes.push(activeRunIndex);
      return indexes.sort((a, b) => a - b);
    },
    initialRect: { width: 0, height: 600 },
    onChange: (instance, sync) => {
      if (sync || followRafRef.current || !shouldFollowBottomRef.current || virtualCount === 0) return;
      followRafRef.current = requestAnimationFrame(() => {
        followRafRef.current = null;
        if (!shouldFollowBottomRef.current) return;
        instance.scrollToIndex(virtualCount - 1, { align: "end" });
      });
    },
  });

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isFarFromBottom = distanceFromBottom > 150;
    shouldFollowBottomRef.current = !isFarFromBottom;
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
    shouldFollowBottomRef.current = true;
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

      const ease = progress < 0.5 ? 4 * progress * progress * progress : 1 - (-2 * progress + 2) ** 3 / 2;

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

  const entryIndexes = React.useMemo(() => {
    const indexes = new Map<string, number>();
    chatEntries.forEach((entry, index) => {
      indexes.set(entry.kind === "run" ? entry.id : entry.item.id, index);
    });
    return indexes;
  }, [chatEntries]);

  const navigateToMessage = useCallback(
    (id: string) => {
      const index = entryIndexes.get(id);
      if (index === undefined) return;
      shouldFollowBottomRef.current = false;
      virtualizer.scrollToIndex(index, { align: "start" });
      setShowScrollDown(true);
    },
    [entryIndexes, virtualizer],
  );

  const handleAnimationEnd = useCallback((e: React.AnimationEvent<HTMLButtonElement>) => {
    if (e.target === e.currentTarget && !scrollRafRef.current) {
      setIsJumping(false);
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || virtualCount === 0) return;
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      shouldFollowBottomRef.current = true;
    }
    if (shouldFollowBottomRef.current) virtualizer.scrollToIndex(virtualCount - 1, { align: "end" });
    followRafRef.current = requestAnimationFrame(() => {
      followRafRef.current = null;
      handleScroll();
    });

    return () => {
      if (followRafRef.current) {
        cancelAnimationFrame(followRafRef.current);
        followRafRef.current = null;
      }
    };
  }, [handleScroll, virtualCount, virtualizer]);

  return (
    <div className="chathistory-wrapper">
      <ChatHistoryRail entries={chatEntries} onNavigate={navigateToMessage} />
      <div
        className="chathistory-container"
        ref={ref}
        onScroll={handleScroll}
        onWheel={handleManualInterrupt}
        onPointerDown={handleManualInterrupt}
      >
        <div className="chathistory-virtualizer" style={{ height: `${virtualizer.getTotalSize()}px` }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const entry = chatEntries[virtualItem.index];
            const id = entry ? (entry.kind === "run" ? entry.id : entry.item.id) : "pending-run";
            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                data-chat-entry-id={id}
                className="chathistory-virtual-entry"
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                {!entry ? (
                  <AgentRun
                    items={[]}
                    allItems={items}
                    isActive
                    showThinking={showThinking}
                    cwd={cwd}
                    onOpenAgentDiff={onOpenAgentDiff}
                  />
                ) : entry.kind === "run" ? (
                  <AgentRun
                    items={entry.items}
                    finalItem={entry.finalItem}
                    allItems={items}
                    isActive={!!busy && entry.id === lastRunId}
                    isFinalStreaming={entry.finalItem?.id === streamingId}
                    showThinking={showThinking}
                    cwd={cwd}
                    onRegenerate={onRegenerate}
                    onDrillDown={onDrillDown}
                    onOpenAgentDiff={onOpenAgentDiff}
                  />
                ) : (
                  <StandaloneItem item={entry.item} onPickModel={onPickModel} onRevert={onRevert} />
                )}
              </div>
            );
          })}
        </div>
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
