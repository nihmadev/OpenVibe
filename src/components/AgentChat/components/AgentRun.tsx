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

function ReasoningActivity({ item, runActive }: { item: HistoryItem; runActive: boolean }): React.ReactElement {
  const { t } = useI18n();
  const isDone = item.reasoningDone === true || item.completedAt !== undefined || !runActive;
  const hasContent = !!item.reasoning?.trim();
  const [open, setOpen] = useState(hasContent && !isDone);
  const wasDone = useRef(isDone);

  useEffect(() => {
    if (isDone && !wasDone.current) setOpen(false);
    wasDone.current = isDone;
  }, [isDone]);

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
        <span className="agent-run__thinking-title">{t(isDone ? "thinkingComplete" : "thinkingInProgress")}</span>
        {hasContent && <ChevronDown className="agent-run__thinking-chevron" aria-hidden="true" />}
      </button>
      {hasContent && open && (
        <div className="agent-run__thinking-content">
          <Markdown content={item.reasoning!} isAssistant={true} noFileIcons={true} isStreaming={!isDone} />
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
  const timing = useMemo(() => getRunTiming(items), [items]);
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

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const start = timing.startedAt ?? (isActive ? mountedAt.current : undefined);
  const end = isActive ? now : timing.completedAt;
  const duration =
    start !== undefined && end !== undefined ? formatRunDurationLabel(Math.max(0, end - start), t) : null;

  const timeLabel = duration
    ? t(isActive ? "agentRunWorkingFor" : "agentRunWorkedFor", { time: duration })
    : isActive
      ? t("agentRunWorking")
      : t("completed");

  return (
    <div className="agent-run">
      <div className="agent-run__summary" aria-live={isActive ? "polite" : "off"}>
        <div className="agent-run__summary-copy">
          <div className={`agent-run__time${isActive ? " agent-run__time--active" : ""}`}>{timeLabel}</div>
        </div>
      </div>
      <div className="agent-run__separator" />

      <div className="agent-run__details">
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
              if (!showThinking) return;
              const hasReasoning = !!(item.reasoning || item.reasoningName);
              const hasNarration = item.id !== finalItem?.id && item.text.trim().length > 0;
              if (!hasReasoning && !hasNarration) return;
              content.push(
                <React.Fragment key={item.id}>
                  {hasReasoning && <ReasoningActivity item={item} runActive={isActive} />}
                  {hasNarration && (
                    <div className="agent-run__narration">
                      <Markdown content={item.text} isAssistant={true} noFileIcons={true} />
                    </div>
                  )}
                </React.Fragment>,
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
