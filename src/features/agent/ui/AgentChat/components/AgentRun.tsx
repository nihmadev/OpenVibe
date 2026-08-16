import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/shared/i18n/useI18n";
import { ToolGlyph } from "@/shared/icons";
import { ChevronDownStrokeIcon, ChevronRightIcon } from "@/shared/icons/icons";
import {
  activitySummaryLabel,
  buildRunTimeline,
  formatRunDurationLabel,
  getRunTiming,
  type RunFlowTool,
  type RunTimelineNode,
} from "../../../model/agentRun";
import type { HistoryItem } from "../../../model/history";
import { AgentToolView } from "../../AgentToolView/AgentToolView";
import { Markdown } from "../../Markdown/Markdown";
import { ErrorNotice } from "./ErrorNotice";
import { MessageFooter } from "./MessageFooter";

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
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}

function FlowToolRow({
  tool,
  cwd,
  onDrillDown,
  onOpenAgentDiff,
}: {
  tool: RunFlowTool;
  cwd?: string;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const displayItem = tool.items[tool.items.length - 1]!;
  const repeats = tool.items.length;

  return (
    <div className="flow-tool">
      <AgentToolView item={displayItem} cwd={cwd} onDrillDown={onDrillDown} onOpenAgentDiff={onOpenAgentDiff} />
      {repeats > 1 && (
        <span className="flow-tool__repeat" title={t("activityRepeatedCalls", { count: repeats })}>
          ×{repeats}
        </span>
      )}
    </div>
  );
}

/**
 * One agent-authored task heading owns the complete run. Narration, research,
 * edits, and commands remain chronological inside a single disclosure.
 */
function WorkBlock({
  nodes,
  title,
  runActive,
  showThinking,
  cwd,
  onRegenerate,
  finalItem,
  onDrillDown,
  onOpenAgentDiff,
  iconToolName,
}: {
  nodes: RunTimelineNode[];
  title: string;
  runActive: boolean;
  showThinking: boolean;
  cwd?: string;
  onRegenerate?: (id: string) => void;
  finalItem?: HistoryItem;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
  iconToolName?: string;
}): React.ReactElement {
  const [open, setOpen] = useState(runActive);
  const wasActive = useRef(runActive);

  useEffect(() => {
    if (runActive) setOpen(true);
    else if (wasActive.current) setOpen(false);
    wasActive.current = runActive;
  }, [runActive]);

  return (
    <div className={`flow-analysis${open ? " flow-analysis--open" : ""}`}>
      <button
        type="button"
        className="flow-analysis__head"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="flow-analysis__icon">
          <ToolGlyph name={iconToolName} state={runActive ? "pending" : "ok"} />
        </span>
        <span className={`flow-analysis__title${runActive ? " flow-analysis__title--active" : ""}`}>{title}</span>
        <span className="flow-analysis__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="flow-analysis__body">
          {nodes.map((node) => {
            switch (node.type) {
              case "reasoning":
                if (!showThinking || !node.item.reasoning?.trim()) return null;
                return (
                  <div className="flow-ghost" key={`reasoning-${node.id}`}>
                    <Markdown
                      content={node.item.reasoning}
                      isAssistant={true}
                      noFileIcons={true}
                      isStreaming={runActive && node.item.reasoningDone !== true}
                    />
                  </div>
                );
              case "narration":
                return (
                  <div className="flow-narration" key={`narration-${node.id}`}>
                    <Markdown content={node.item.text} isAssistant={true} noFileIcons={true} />
                  </div>
                );
              case "analysis":
                return node.tools.map((tool) => (
                  <FlowToolRow
                    key={tool.id}
                    tool={tool}
                    cwd={cwd}
                    onDrillDown={onDrillDown}
                    onOpenAgentDiff={onOpenAgentDiff}
                  />
                ));
              case "tool":
                return (
                  <FlowToolRow
                    key={node.id}
                    tool={{ id: node.id, kind: node.kind, items: node.items }}
                    cwd={cwd}
                    onDrillDown={onDrillDown}
                    onOpenAgentDiff={onOpenAgentDiff}
                  />
                );
              case "error":
                return (
                  <div className="flow-error" key={`error-${node.id}`}>
                    <ErrorNotice
                      text={node.item.text}
                      onRetry={onRegenerate && finalItem ? () => onRegenerate(finalItem.id) : undefined}
                    />
                  </div>
                );
              case "info":
                return (
                  <div className="flow-info agent-run__notice agent-run__notice--info" key={`info-${node.id}`}>
                    {node.item.text}
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
  );
}

function AgentRunComponent({
  items,
  finalItem,
  allItems,
  isActive,
  isFinalStreaming = false,
  showThinking,
  cwd,
  onRegenerate,
  onDrillDown,
  onOpenAgentDiff,
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
    () =>
      showThinking
        ? nodes
        : nodes.filter((node) => node.type !== "reasoning" || Boolean(node.item.reasoningName?.trim())),
    [nodes, showThinking],
  );
  const hasNodes = visibleNodes.length > 0;
  const workTitle = useMemo(() => {
    const namedReasoning = nodes.find(
      (node): node is Extract<RunTimelineNode, { type: "reasoning" }> =>
        node.type === "reasoning" && Boolean(node.item.reasoningName?.trim()),
    );
    if (namedReasoning?.item.reasoningName) return namedReasoning.item.reasoningName.trim();
    return activitySummaryLabel(nodes, t);
  }, [nodes, t]);
  const iconToolName = useMemo(() => {
    const tools = nodes.flatMap((node) =>
      node.type === "tool" ? node.items : node.type === "analysis" ? node.tools.flatMap((tool) => tool.items) : [],
    );
    const pending = [...tools].reverse().find((item) => item.ok === undefined);
    return (pending ?? tools[0])?.toolName;
  }, [nodes]);

  return (
    <div className={`agent-run${isActive ? " agent-run--active" : " agent-run--completed"}`}>
      {hasNodes && (
        <div className="agent-run__summary" aria-live={isActive ? "polite" : "off"}>
          <button
            className={`agent-run__head${!expanded ? " agent-run__head--collapsed" : ""}`}
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? t("hideToolCalls") : t("showToolCalls")}
          >
            <span className={`agent-run__time${isActive ? " agent-run__time--active" : ""}`}>{timeLabel}</span>
            <ChevronDownStrokeIcon className="agent-run__head-chevron" aria-hidden="true" />
          </button>
        </div>
      )}
      {hasNodes && <div className="agent-run__separator" aria-hidden="true" />}
      {hasNodes && expanded && workTitle && (
        <div className="agent-flow agent-run__activity">
          <WorkBlock
            nodes={visibleNodes}
            title={workTitle}
            runActive={isActive}
            showThinking={showThinking}
            cwd={cwd}
            onRegenerate={onRegenerate}
            finalItem={finalItem}
            onDrillDown={onDrillDown}
            onOpenAgentDiff={onOpenAgentDiff}
            iconToolName={iconToolName}
          />
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
            <MessageFooter
              item={finalItem}
              items={allItems}
              runItems={items}
              onRegenerate={onRegenerate}
              cwd={cwd}
              onOpenAgentDiff={onOpenAgentDiff}
            />
          )}
        </div>
      )}
    </div>
  );
}

function sameItemReferences(left: HistoryItem[], right: HistoryItem[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

export const AgentRun = React.memo(AgentRunComponent, (previous, next) => {
  if (previous.isActive || next.isActive) return false;
  if (!sameItemReferences(previous.items, next.items)) return false;
  if (previous.finalItem !== next.finalItem) return false;
  if (previous.allItems.length !== next.allItems.length) return false;
  return (
    previous.isFinalStreaming === next.isFinalStreaming &&
    previous.showThinking === next.showThinking &&
    previous.cwd === next.cwd &&
    previous.onRegenerate === next.onRegenerate &&
    previous.onDrillDown === next.onDrillDown &&
    previous.onOpenAgentDiff === next.onOpenAgentDiff
  );
});
