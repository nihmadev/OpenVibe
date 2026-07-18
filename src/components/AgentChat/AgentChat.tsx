import React, { useRef, useState, useCallback, useEffect } from "react";
import "./AgentChat.css";
import "./FBadge.css";

import { Props } from "./types.js";
import { MessageFooter } from "./components/MessageFooter.js";
import { VibingLoader } from "./components/VibingLoader.js";
import { ThinkingBlock } from "./components/ThinkingBlock.js";
import { UserMessageActions } from "./components/UserMessageActions.js";
import { ToolGroup } from "./components/ToolGroup.js";
import { AgentToolView } from "../AgentToolView/AgentToolView.js";
import { Markdown } from "../Markdown/Markdown.js";
import { HistoryItem } from "./types.js";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useI18n } from "../../hooks/useI18n.js";

// Re-export types for backward compatibility
export type { AttachmentView, HistoryItem, Props } from "./types.js";

const MessageItem = React.memo(
  ({
    item,
    onPickModel,
    onRegenerate,
    onRevert,
    isStreaming,
    items,
    busy,
    cwd,
    showThinking,
    onDrillDown,
  }: {
    item: HistoryItem;
    onPickModel?: (id: string) => void;
    onRegenerate?: (id: string) => void;
    onRevert?: (id: string) => void;
    isStreaming: boolean;
    items: HistoryItem[];
    busy: boolean;
    cwd?: string;
    showThinking: boolean;
    onDrillDown?: (id: string) => void;
  }) => {
    const { t } = useI18n();

    const cls = `msg msg--${item.kind}`;

    const { isLastAssistantInTurn, isTurnFinished } = React.useMemo(() => {
      if (item.kind !== "assistant") return { isLastAssistantInTurn: false, isTurnFinished: false };
      const idx = items.findIndex((it) => it.id === item.id);
      if (idx < 0) return { isLastAssistantInTurn: false, isTurnFinished: false };

      let lastAssistant = true;
      let hasUserAfter = false;

      for (let i = idx + 1; i < items.length; i++) {
        const it = items[i]!;
        if (it.kind === "assistant") {
          lastAssistant = false;
        }
        if (it.kind === "user") {
          hasUserAfter = true;
          break;
        }
      }

      return {
        isLastAssistantInTurn: lastAssistant,
        isTurnFinished: hasUserAfter || !busy,
      };
    }, [item.id, item.kind, items, busy]);

    if (item.kind === "tool") return <AgentToolView item={item} onDrillDown={onDrillDown} cwd={cwd} />;

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
              <span className="modelpicker__check">✓</span>
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

    if (item.kind === "stopped") {
      return (
        <div className="msg msg--info msg--stopped">
          <div className="msg--stopped-line" />
          <span className="msg--stopped-text">{t("manuallyStopped")}</span>
          <div className="msg--stopped-line" />
        </div>
      );
    }

    const showFooter =
      item.kind === "assistant" && !isStreaming && item.text.length > 0 && isLastAssistantInTurn && isTurnFinished;

    return (
      <div className={cls}>
        {showThinking && item.reasoning && (
          <ThinkingBlock
            reasoning={item.reasoning}
            reasoningDone={item.reasoningDone}
            reasoningName={item.reasoningName}
          />
        )}
        <Markdown content={item.text} isAssistant={item.kind === "assistant"} isStreaming={isStreaming} />
        {isStreaming && item.text.length === 0 && !item.reasoning && <VibingLoader />}
        {showFooter && <MessageFooter item={item} items={items} onRegenerate={onRegenerate} cwd={cwd} />}
      </div>
    );
  },
  (prev, next) => {
    if (prev.isStreaming !== next.isStreaming) return false;
    if (prev.busy !== next.busy) return false;
    if (prev.onRevert !== next.onRevert) return false;
    if (prev.item.text !== next.item.text) return false;
    if (prev.item.ok !== next.item.ok) return false;
    if (next.item.kind === "assistant" && !next.isStreaming) {
      // Footer needs items for diff/token count
      return prev.items === next.items;
    }
    return true;
  },
);

type ProcessedItem = { kind: "single"; item: HistoryItem } | { kind: "group"; items: HistoryItem[] };

function processItems(input: HistoryItem[]): ProcessedItem[] {
  const result: ProcessedItem[] = [];
  let run: HistoryItem[] = [];

  const analysisTools = new Set(["read_file", "view_file", "search_codebase", "grep_search", "list_dir", "agent"]);

  const isAnalysisTool = (item: HistoryItem): boolean => item.kind === "tool" && analysisTools.has(item.toolName ?? "");

  const flush = () => {
    if (run.length === 0) return;
    result.push({ kind: "group", items: run });
    run = [];
  };

  for (const item of input) {
    if (isAnalysisTool(item)) {
      run.push(item);
    } else {
      flush();
      result.push({ kind: "single", item });
    }
  }
  flush();
  return result;
}

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

  const processedItems = React.useMemo(() => processItems(items ?? []), [items]);

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
        {processedItems.map((entry) => {
          if (entry.kind === "group") {
            return <ToolGroup key={entry.items[0]!.id} items={entry.items} cwd={cwd} />;
          }
          return (
            <MessageItem
              key={entry.item.id}
              item={entry.item}
              onPickModel={onPickModel}
              onRegenerate={onRegenerate}
              onRevert={onRevert}
              isStreaming={entry.item.id === streamingId}
              items={items}
              busy={!!busy}
              cwd={cwd}
              showThinking={showThinking}
              onDrillDown={onDrillDown}
            />
          );
        })}

        {busy && !streamingId && !(items ?? []).some((it) => it.kind === "tool" && it.ok === undefined) && (
          <VibingLoader />
        )}
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
