import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/shared/i18n/useI18n";
import { ChevronDownStrokeIcon, ChevronRightIcon } from "@/shared/icons/icons";
import {
  analysisKindCounts,
  buildRunTimeline,
  formatRunDurationLabel,
  getRunTiming,
  type RunFlowTool,
  type ToolActivityKind,
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

/** Model thinking stays visible as subdued text directly in the run flow. */
function ThinkingBlock({
  item,
  runActive,
  showBody,
}: {
  item: HistoryItem;
  runActive: boolean;
  showBody: boolean;
}): React.ReactElement | null {
  const { t } = useI18n();
  const isDone = !runActive || item.reasoningDone === true || item.completedAt !== undefined;
  const body = showBody ? (item.reasoning?.trim() ?? "") : "";
  const title = item.reasoningName?.trim() || (showBody && !isDone ? t("flowThinking") : "");
  if (!body && !title) return null;

  return (
    <div className="flow-thinking">
      {title && <div className={`flow-thinking__title${!isDone ? " flow-thinking__title--active" : ""}`}>{title}</div>}
      {body && (
        <div className="flow-ghost">
          <Markdown content={body} isAssistant={true} noFileIcons={true} isStreaming={!isDone} />
        </div>
      )}
    </div>
  );
}

function toolIsPending(tool: RunFlowTool): boolean {
  return tool.items.some((item) => item.ok === undefined);
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

const ANALYSIS_COUNT_KEYS: Partial<Record<ToolActivityKind, string>> = {
  read: "flowCountRead",
  search: "flowCountSearch",
  browse: "flowCountBrowse",
  web: "flowCountWeb",
  git: "flowCountGit",
};

/**
 * A burst of consecutive read-only research calls (reads, searches, folder
 * listing, web, git) folded into a single "Analysis" group. It stays open
 * while the agent is still researching and folds into one summary row once
 * the burst is finished.
 */
function AnalysisGroup({
  node,
  runActive,
  cwd,
  onDrillDown,
  onOpenAgentDiff,
}: {
  node: { id: string; tools: RunFlowTool[] };
  runActive: boolean;
  cwd?: string;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const anyPending = runActive && node.tools.some(toolIsPending);
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const open = manualOpen ?? anyPending;

  const summary = useMemo(
    () =>
      analysisKindCounts(node.tools)
        .map(([kind, count]) => t(ANALYSIS_COUNT_KEYS[kind] ?? "activityGroupToolsN", { count }))
        .join(", "),
    [node.tools, t],
  );

  return (
    <div className={`flow-analysis${open ? " flow-analysis--open" : ""}`}>
      <button type="button" className="flow-analysis__head" onClick={() => setManualOpen(!open)} aria-expanded={open}>
        <span className={`flow-analysis__title${anyPending ? " flow-analysis__title--active" : ""}`}>
          {t("flowAnalysis")}
        </span>
        <span className="flow-analysis__counts">{summary}</span>
        <span className="flow-analysis__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="flow-analysis__body">
          {node.tools.map((tool) => (
            <FlowToolRow
              key={tool.id}
              tool={tool}
              cwd={cwd}
              onDrillDown={onDrillDown}
              onOpenAgentDiff={onOpenAgentDiff}
            />
          ))}
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
      {hasNodes && <div className="agent-run__separator" aria-hidden="true" />}

      {hasNodes && expanded && (
        <div className="agent-flow agent-run__activity">
          {visibleNodes.map((node) => {
            switch (node.type) {
              case "reasoning":
                return (
                  <ThinkingBlock
                    key={`reasoning-${node.id}`}
                    item={node.item}
                    runActive={isActive}
                    showBody={showThinking}
                  />
                );
              case "narration":
                return (
                  <div className="flow-narration" key={`narration-${node.id}`}>
                    <Markdown content={node.item.text} isAssistant={true} noFileIcons={true} />
                  </div>
                );
              case "analysis":
                return (
                  <AnalysisGroup
                    key={`analysis-${node.id}`}
                    node={node}
                    runActive={isActive}
                    cwd={cwd}
                    onDrillDown={onDrillDown}
                    onOpenAgentDiff={onOpenAgentDiff}
                  />
                );
              case "tool":
                return (
                  <FlowToolRow
                    key={`tool-${node.id}`}
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
