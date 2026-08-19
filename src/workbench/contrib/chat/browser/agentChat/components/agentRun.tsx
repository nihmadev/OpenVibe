import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDownStrokeIcon, ToolGlyph } from "@/base/browser/ui/icons/iconRegistry";
import { Loader } from "@/base/browser/ui/loader/loader";
import { useI18n } from "@/platform/localization/localizationService";
import type { HistoryItem } from "@/workbench/common/conversation";
import { Markdown } from "../../../../../browser/parts/editor/markdown/markdown";
import {
  activitySummaryLabel,
  buildRunTimeline,
  formatRunDurationLabel,
  getRunTiming,
  isInternalToolActivity,
  type RunTimelineNode,
  toolActivityTitle,
} from "../../../../../services/agent/common/agentRun";
import { AnimatedSummary } from "../../agentToolView/animatedSummary";
import { BrowserActivityGroup } from "../../agentToolView/browserActivityGroup";
import { ErrorNotice } from "./errorNotice";
import { FlowToolRow } from "./exploreBlock";
import { MessageFooter } from "./messageFooter";
import { ReasoningBlock } from "./reasoningBlock";

// ZCode collapsible timing (zcode-collapsible-up): 300ms height ease.
const COLLAPSE_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

interface RunNodeContext {
  runActive: boolean;
  showThinking: boolean;
  cwd?: string;
  onRegenerate?: (id: string) => void;
  finalItem?: HistoryItem;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}

/**
 * ZCode-style work process: every timeline node renders directly inside the
 * "Worked for …" container — one flat list of tool rows, ZCode thinking
 * blocks and narration, with no intermediate accordion grouping them into a
 * single collapsed listing. Research bursts fold into Explore blocks.
 */
function RunNodeView({ node, ctx }: { node: RunTimelineNode; ctx: RunNodeContext }): React.ReactNode {
  switch (node.type) {
    case "reasoning":
      if (!ctx.showThinking || !node.item.reasoning?.trim()) return null;
      return <ReasoningBlock key={`reasoning-${node.id}`} item={node.item} isActive={ctx.runActive} />;
    case "narration":
      return (
        <div className="flow-narration" key={`narration-${node.id}`}>
          <Markdown content={node.item.text} isAssistant={true} noFileIcons={true} />
        </div>
      );
    case "analysis":
      // Codex keeps exploration in the completed summary, but its disclosure
      // body is still the chronological list of the actual tool calls.
      return (
        <React.Fragment key={`analysis-${node.id}`}>
          {node.tools.map((tool) => (
            <FlowToolRow
              key={tool.id}
              tool={tool}
              cwd={ctx.cwd}
              onDrillDown={ctx.onDrillDown}
              onOpenAgentDiff={ctx.onOpenAgentDiff}
            />
          ))}
        </React.Fragment>
      );
    case "browser":
      return <BrowserActivityGroup key={`browser-${node.id}`} items={node.items} runActive={ctx.runActive} />;
    case "tool":
      return (
        <FlowToolRow
          key={node.id}
          tool={{ id: node.id, kind: node.kind, items: node.items }}
          cwd={ctx.cwd}
          onDrillDown={ctx.onDrillDown}
          onOpenAgentDiff={ctx.onOpenAgentDiff}
        />
      );
    case "error":
      return (
        <div className="flow-error" key={`error-${node.id}`}>
          <ErrorNotice
            text={node.item.text}
            onRetry={ctx.onRegenerate && ctx.finalItem ? () => ctx.onRegenerate!(ctx.finalItem!.id) : undefined}
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
}

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
  const reducedMotion = useReducedMotion();
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
  const toolItems = useMemo(
    () => items.filter((item) => item.kind === "tool" && item.toolName !== "todo" && !isInternalToolActivity(item)),
    [items],
  );
  const activeTool = useMemo(
    () => [...toolItems].reverse().find((item) => item.ok === undefined) ?? toolItems.at(-1),
    [toolItems],
  );
  const completedSummary = useMemo(() => activitySummaryLabel(nodes, t), [nodes, t]);
  const activityLabel = isActive
    ? activeTool
      ? toolActivityTitle(activeTool, t)
      : t("flowThinking")
    : (completedSummary ?? t("flowThought"));
  const activityKey = isActive ? (activeTool?.id ?? "thinking") : `complete:${activityLabel}`;

  return (
    <div className={`agent-run${isActive ? " agent-run--active" : " agent-run--completed"}`}>
      {isActive && !hasNodes && !finalItem && (
        <div className="agent-run__pending" role="status" aria-label={t("flowThinking")}>
          <Loader />
        </div>
      )}
      {hasNodes && <div className="agent-run__timing">{timeLabel}</div>}
      {hasNodes && <div className="agent-run__separator" aria-hidden="true" />}
      {hasNodes && (
        <div className="agent-run__summary" aria-live={isActive ? "polite" : "off"}>
          <button
            className={`agent-run__head${!expanded ? " agent-run__head--collapsed" : ""}`}
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? t("hideToolCalls") : t("showToolCalls")}
          >
            <span className="agent-run__head-icon">
              <ToolGlyph
                name={activeTool?.toolName}
                state={activeTool?.ok === false ? "error" : isActive ? "pending" : "ok"}
              />
            </span>
            <AnimatedSummary
              contentKey={activityKey}
              enabled={isActive}
              primary={
                <span className={`agent-run__activity-label${isActive ? " agent-run__activity-label--active" : ""}`}>
                  {activityLabel}
                </span>
              }
            />
            <ChevronDownStrokeIcon className="agent-run__head-chevron" aria-hidden="true" />
          </button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {hasNodes && expanded && (
          <motion.div
            className="agent-run__activity-anim"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : COLLAPSE_TRANSITION}
          >
            <div className="agent-flow agent-run__activity">
              {visibleNodes.map((node) => (
                <RunNodeView
                  key={node.id}
                  node={node}
                  ctx={{
                    runActive: isActive,
                    showThinking,
                    cwd,
                    onRegenerate,
                    finalItem,
                    onDrillDown,
                    onOpenAgentDiff,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
