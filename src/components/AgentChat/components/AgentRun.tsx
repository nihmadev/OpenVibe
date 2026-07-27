import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BotIcon,
  BookOpenIcon,
  ChevronDownStrokeIcon,
  FolderOpenStrokeIcon,
  GlobeIcon,
  PencilIcon,
  SearchStrokeIcon,
  ServerIcon,
  SquareTerminalIcon,
  WrenchIcon,
} from "../../Icons/icons.js";
import { Markdown } from "../../Markdown/Markdown.js";
import { useI18n } from "../../../hooks/useI18n.js";
import { MessageFooter } from "./MessageFooter.js";
import type { HistoryItem } from "../types.js";
import { buildRunTimeline, formatRunDurationLabel, getRunTiming, type ToolActivityKind } from "../agentRunModel.js";
import { AgentToolView } from "../../AgentToolView/AgentToolView.js";
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

function ToolKindMarker({ kind }: { kind: ToolActivityKind }): React.ReactElement {
  const props = { size: 14, strokeWidth: 1.7, "aria-hidden": true } as const;
  switch (kind) {
    case "git":
      return <img src="/icons/providers/github.svg" width={14} height={14} alt="" aria-hidden="true" />;
    case "search":
      return <SearchStrokeIcon {...props} />;
    case "web":
      return <GlobeIcon {...props} />;
    case "read":
      return <BookOpenIcon {...props} />;
    case "edit":
      return <PencilIcon {...props} />;
    case "command":
      return <SquareTerminalIcon {...props} />;
    case "browse":
      return <FolderOpenStrokeIcon {...props} />;
    case "agent":
      return <BotIcon {...props} />;
    case "external":
      return <ServerIcon {...props} />;
    default:
      return <WrenchIcon {...props} />;
  }
}

/**
 * Reasoning shown as a graph node: a small dot on the timeline with the full
 * thought text right beside it (no accordion), matching the Copilot layout.
 */
function ReasoningNode({ item, runActive }: { item: HistoryItem; runActive: boolean }): React.ReactElement {
  const isDone = !runActive || item.reasoningDone === true || item.completedAt !== undefined;
  const body = item.reasoning?.trim() ?? "";
  const title = item.reasoningName?.trim() ?? "";

  return (
    <div className="agent-graph__node agent-graph__node--reasoning">
      <span
        className={`agent-graph__marker agent-graph__marker--dot${!isDone ? " agent-graph__marker--active" : ""}`}
        aria-hidden="true"
      />
      <div className="agent-graph__body agent-graph__reasoning">
        {title && <span className="agent-graph__reasoning-title">{title}</span>}
        {body && (
          <span className="agent-graph__reasoning-text">
            <Markdown content={body} isAssistant={true} noFileIcons={true} isStreaming={!isDone} />
          </span>
        )}
      </div>
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
  const nodes = useMemo(() => buildRunTimeline(items, finalItem?.id), [items, finalItem?.id]);
  const wasStopped = items.some((item) => item.kind === "stopped");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isActive]);

  const start = timing.startedAt ?? mountedAt.current;
  const end = isActive ? now : (timing.completedAt ?? now);
  const duration = formatRunDurationLabel(Math.max(0, end - start), t);
  const timeLabel = t(isActive ? "agentRunWorkingFor" : "agentRunWorkedFor", { time: duration });

  const visibleNodes = useMemo(
    () => (showThinking ? nodes : nodes.filter((node) => node.type !== "reasoning")),
    [nodes, showThinking],
  );
  const hasNodes = visibleNodes.length > 0;

  return (
    <div className={`agent-run${isActive ? " agent-run--active" : " agent-run--completed"}`}>
      <div className="agent-run__summary" aria-live={isActive ? "polite" : "off"}>
        <button
          className={`agent-run__head${!expanded ? " agent-run__head--collapsed" : ""}`}
          type="button"
          onClick={() => hasNodes && setExpanded((v) => !v)}
          aria-expanded={hasNodes ? expanded : undefined}
          disabled={!hasNodes}
          aria-label={expanded ? t("hideToolCalls") : t("showToolCalls")}
        >
          <span className={`agent-run__time${isActive ? " agent-run__time--active" : ""}`}>{timeLabel}</span>
          {hasNodes && <ChevronDownStrokeIcon className="agent-run__head-chevron" aria-hidden="true" />}
        </button>
      </div>

      {hasNodes && expanded && (
        <div className="agent-graph">
          {visibleNodes.map((node) => {
            switch (node.type) {
              case "reasoning":
                return <ReasoningNode key={`reasoning-${node.id}`} item={node.item} runActive={isActive} />;
              case "narration":
                return (
                  <div className="agent-graph__node agent-graph__node--narration" key={`narration-${node.id}`}>
                    <span className="agent-graph__marker agent-graph__marker--dot" aria-hidden="true" />
                    <div className="agent-graph__body agent-graph__narration">
                      <Markdown content={node.item.text} isAssistant={true} noFileIcons={true} />
                    </div>
                  </div>
                );
              case "tool": {
                const displayItem = node.items[node.items.length - 1]!;
                const repeats = node.items.length;
                return (
                  <div className="agent-graph__node agent-graph__node--tool" key={`tool-${node.id}`}>
                    <span className="agent-graph__marker agent-graph__marker--icon" aria-hidden="true">
                      <ToolKindMarker kind={node.kind} />
                    </span>
                    <div className="agent-graph__body agent-graph__tool">
                      <AgentToolView item={displayItem} cwd={cwd} onDrillDown={onDrillDown} />
                      {repeats > 1 && (
                        <span className="agent-graph__repeat" title={t("activityRepeatedCalls", { count: repeats })}>
                          ×{repeats}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
              case "error":
                return (
                  <div className="agent-graph__node agent-graph__node--error" key={`error-${node.id}`}>
                    <span
                      className="agent-graph__marker agent-graph__marker--dot agent-graph__marker--err"
                      aria-hidden="true"
                    />
                    <div className="agent-graph__body">
                      <ErrorNotice
                        text={node.item.text}
                        onRetry={onRegenerate && finalItem ? () => onRegenerate(finalItem.id) : undefined}
                      />
                    </div>
                  </div>
                );
              case "info":
                return (
                  <div className="agent-graph__node agent-graph__node--info" key={`info-${node.id}`}>
                    <span className="agent-graph__marker agent-graph__marker--dot" aria-hidden="true" />
                    <div className="agent-graph__body agent-run__notice agent-run__notice--info">{node.item.text}</div>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      )}

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
