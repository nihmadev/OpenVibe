import React, { useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "../../Markdown/Markdown.js";
import { useI18n } from "../../../hooks/useI18n.js";
import { MessageFooter } from "./MessageFooter.js";
import type { HistoryItem } from "../types.js";
import { formatRunDurationLabel, getRunTiming, groupToolActivities } from "../agentRunModel.js";
import { Brain, ChevronDown } from "lucide-react";
import { AgentToolView } from "../../AgentToolView/AgentToolView.js";
import { ActivityGroup } from "./ActivityGroup.js";
import { ErrorNotice } from "./ErrorNotice.js";

interface AgentRunProps {
  items: HistoryItem[];
  finalItem?: HistoryItem;
  allItems: HistoryItem[];
  isActive: boolean;
  isFinalStreaming?: boolean;
  showThinking: boolean;
  cwd?: string;
  onRegenerate?: (id: string) => void;
  onDrillDown?: (id: string) => void;
}

function ConsolidatedReasoning({
  items,
  runActive,
}: {
  items: HistoryItem[];
  runActive: boolean;
}): React.ReactElement | null {
  const { t } = useI18n();

  const reasoningItems = useMemo(
    () =>
      items.filter((item) => {
        if (item.kind !== "assistant") return false;
        const body = item.reasoning?.trim();
        if (!body && !item.reasoningName) return false;
        if (
          body === "Analyzing and preparing tool execution." ||
          body === "Executing tool call." ||
          body === "Thinking about tool call execution."
        ) {
          return false;
        }
        return true;
      }),
    [items],
  );

  const isDone =
    !runActive ||
    (reasoningItems.length > 0 &&
      reasoningItems.every((it) => it.reasoningDone === true || it.completedAt !== undefined));
  const hasContent = reasoningItems.some((it) => it.reasoning?.trim() || it.reasoningName);
  const [open, setOpen] = useState(hasContent && !isDone);
  const wasDone = useRef(isDone);

  useEffect(() => {
    if (isDone && !wasDone.current) setOpen(false);
    wasDone.current = isDone;
  }, [isDone]);

  if (reasoningItems.length === 0) return null;

  const latestActiveItem = reasoningItems[reasoningItems.length - 1];
  const activeTitle = latestActiveItem?.reasoningName || t("thinkingInProgress");
  const titleText = !isDone
    ? activeTitle
    : reasoningItems.length > 1
      ? `${t("thinkingComplete")} (${reasoningItems.length})`
      : t("thinkingComplete");

  return (
    <div className="agent-run__reasoning">
      <button
        className={`agent-run__thinking${!isDone ? " agent-run__thinking--active" : ""}`}
        type="button"
        onClick={() => hasContent && setOpen((value) => !value)}
        aria-expanded={hasContent ? open : undefined}
        disabled={!hasContent}
      >
        <span className="agent-run__thinking-icon">
          <Brain aria-hidden="true" />
        </span>
        <span className="agent-run__thinking-title">{titleText}</span>
        {hasContent && <ChevronDown className="agent-run__thinking-chevron" aria-hidden="true" />}
      </button>
      {hasContent && open && (
        <div className="agent-run__thinking-content">
          <div className="agent-run__thinking-steps">
            {reasoningItems.map((item, idx) => {
              const title = item.reasoningName;
              const body = item.reasoning?.trim();
              const itemDone = item.reasoningDone === true || item.completedAt !== undefined || !runActive;
              return (
                <div key={item.id || idx} className="agent-run__thinking-step">
                  <div className="agent-run__thinking-step-marker">
                    <span
                      className={`agent-run__thinking-step-dot${!itemDone ? " agent-run__thinking-step-dot--active" : ""}`}
                    />
                    <span className="agent-run__thinking-step-line" />
                  </div>
                  <div className="agent-run__thinking-step-body">
                    {title && <div className="agent-run__thinking-step-title">{title}</div>}
                    {body && (
                      <div className="agent-run__thinking-step-text">
                        <Markdown content={body} isAssistant={true} noFileIcons={true} isStreaming={!itemDone} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentRun({
  items,
  finalItem,
  allItems,
  isActive,
  isFinalStreaming = false,
  showThinking,
  cwd,
  onRegenerate,
  onDrillDown,
}: AgentRunProps): React.ReactElement {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  const mountedAt = useRef(now);
  const timing = useMemo(() => getRunTiming(items, allItems), [items, allItems]);
  const toolActivityGroups = useMemo(() => groupToolActivities(items), [items]);
  const toolGroupByFirstId = useMemo(
    () => new Map(toolActivityGroups.map((group) => [group[0]!.id, group])),
    [toolActivityGroups],
  );
  const groupedToolIds = useMemo(
    () => new Set(toolActivityGroups.flatMap((group) => group.map((item) => item.id))),
    [toolActivityGroups],
  );
  const wasStopped = items.some((item) => item.kind === "stopped");
  const [toolsExpanded, setToolsExpanded] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const start = timing.startedAt ?? mountedAt.current;
  const end = isActive ? now : (timing.completedAt ?? now);
  const duration = formatRunDurationLabel(Math.max(0, end - start), t);

  const timeLabel = t(isActive ? "agentRunWorkingFor" : "agentRunWorkedFor", { time: duration });

  return (
    <div className={`agent-run${isActive ? " agent-run--active" : " agent-run--completed"}`}>
      <div className="agent-run__summary" aria-live={isActive ? "polite" : "off"}>
        <div className="agent-run__summary-copy">
          <div className={`agent-run__time${isActive ? " agent-run__time--active" : ""}`}>{timeLabel}</div>
        </div>
        <button
          className={`agent-run__toggle${!toolsExpanded ? " agent-run__toggle--collapsed" : ""}`}
          type="button"
          onClick={() => setToolsExpanded((v) => !v)}
          aria-expanded={toolsExpanded}
          aria-label={toolsExpanded ? t("hideToolCalls") : t("showToolCalls")}
        >
          <ChevronDown className="agent-run__toggle-chevron" aria-hidden="true" />
        </button>
      </div>
      <div className={`agent-run__separator${!isActive ? " agent-run__separator--hidden" : ""}`} />

      <div className={`agent-run__details${!toolsExpanded ? " agent-run__details--collapsed" : ""}`}>
        {showThinking && <ConsolidatedReasoning items={items} runActive={isActive} />}
        {(() => {
          const content: React.ReactNode[] = [];
          items.forEach((item) => {
            if (item.kind === "tool") {
              // Task-list updates are rendered once above the prompt input.
              // Keep them out of the activity/tool feed to avoid duplication.
              if (item.toolName === "todo") return;

              const group = toolGroupByFirstId.get(item.id);
              if (group) {
                content.push(
                  <ActivityGroup key={`tools-${item.id}`} items={group} cwd={cwd} onDrillDown={onDrillDown} />,
                );
              } else if (!groupedToolIds.has(item.id)) {
                content.push(
                  <div className="agent-run__tool" key={item.id}>
                    <AgentToolView item={item} cwd={cwd} onDrillDown={onDrillDown} />
                  </div>,
                );
              }
              return;
            }
            if (item.kind === "assistant") {
              const hasNarration = item.id !== finalItem?.id && item.text.trim().length > 0;
              if (!hasNarration) return;
              content.push(
                <div className="agent-run__narration" key={item.id}>
                  <Markdown content={item.text} isAssistant={true} noFileIcons={true} />
                </div>,
              );
              return;
            }
            if (item.kind === "error" || item.kind === "info") {
              if (item.kind === "error") {
                content.push(
                  <ErrorNotice
                    key={item.id}
                    text={item.text}
                    onRetry={onRegenerate && finalItem ? () => onRegenerate(finalItem.id) : undefined}
                  />,
                );
                return;
              }
              content.push(
                <div className={`agent-run__notice agent-run__notice--${item.kind}`} key={item.id}>
                  {item.text}
                </div>,
              );
            }
          });
          return content;
        })()}
      </div>

      {wasStopped && (
        <div className="msg msg--info msg--stopped">
          <div className="msg--stopped-line" />
          <span className="msg--stopped-text">{t("manuallyStopped")}</span>
          <div className="msg--stopped-line" />
        </div>
      )}

      {finalItem && (
        <div className="agent-run__answer">
          <Markdown content={finalItem.text} isAssistant={true} isStreaming={isFinalStreaming} />
          {!isActive && (
            <MessageFooter item={finalItem} items={allItems} runItems={items} onRegenerate={onRegenerate} cwd={cwd} />
          )}
        </div>
      )}
    </div>
  );
}
