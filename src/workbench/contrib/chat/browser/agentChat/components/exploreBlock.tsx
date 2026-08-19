import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type React from "react";
import { ChevronRightIcon, ToolGlyph } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import { describe } from "@/workbench/services/agent/common/agentToolPresentation";
import type { RunFlowTool } from "../../../../../services/agent/common/agentRun";
import { AgentToolView } from "../../agentToolView/agentToolView";
import { AnimatedSummary } from "../../agentToolView/animatedSummary";
import { useToolDisclosure } from "../../agentToolView/useToolDisclosure";

const COLLAPSE_TRANSITION = { duration: 0.3, ease: [0.4, 0, 0.2, 1] } as const;

/** ZCode explore buckets: "2 searches, 1 list, 1 read" — lowercase English terms. */
function exploreCounts(tools: RunFlowTool[]): string {
  const buckets = { search: 0, list: 0, read: 0 };
  for (const tool of tools) {
    const count = tool.items.length;
    if (tool.kind === "read") buckets.read += count;
    else if (tool.kind === "browse") buckets.list += count;
    // search, web and git lookups all count as searches (ZCode's vpt bucketing)
    else buckets.search += count;
  }
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts: string[] = [];
  if (buckets.search > 0) parts.push(plural(buckets.search, "search", "searches"));
  if (buckets.list > 0) parts.push(plural(buckets.list, "list", "lists"));
  if (buckets.read > 0) parts.push(plural(buckets.read, "read", "reads"));
  return parts.join(", ");
}

export interface FlowToolRowProps {
  tool: RunFlowTool;
  cwd?: string;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}

export function FlowToolRow({ tool, cwd, onDrillDown, onOpenAgentDiff }: FlowToolRowProps): React.ReactElement {
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
 * ZCode "Explore" group: a burst of research tool calls. While the burst is
 * running, the header shows the live activity ("Reading src/a.ts" with the
 * full file path, swapped with the stream animation as calls progress); once
 * it completes the whole burst folds into a count summary ("Reading 5 files,
 * Search — 2 queries"), expandable back into individual tool rows.
 */
export function ExploreBlock({
  tools,
  runActive,
  cwd,
  onDrillDown,
  onOpenAgentDiff,
}: {
  tools: RunFlowTool[];
  runActive: boolean;
  cwd?: string;
  onDrillDown?: (id: string) => void;
  onOpenAgentDiff?: (toolCallId: string, path: string) => void;
}): React.ReactElement {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const flat = tools.flatMap((tool) => tool.items);
  const isRunning = runActive && flat.some((item) => item.ok === undefined);
  const { open, toggle } = useToolDisclosure(`explore:${tools[0]!.id}`, {
    isRunning,
    autoOpen: true,
    autoCollapseOnComplete: true,
  });

  const countsSummary = exploreCounts(tools);

  const liveItem = [...flat].reverse().find((item) => item.ok === undefined) ?? flat[flat.length - 1]!;
  const { verb, file, suffix } = describe(liveItem, cwd, t);
  const liveDetail = file?.rawPath || file?.name || suffix;
  const liveSummary = liveDetail ? `${verb} ${liveDetail}` : verb;
  const summaryKey = isRunning ? `live:${liveItem.id}:${liveDetail ?? ""}` : `counts:${countsSummary}`;
  const summaryText = isRunning ? liveSummary : countsSummary;

  return (
    <div className={`explore${open ? " explore--open" : ""}`}>
      <button type="button" className="explore__head" aria-expanded={open} onClick={toggle}>
        <span className="explore__icon">
          <ToolGlyph name="search_codebase" state={isRunning ? "pending" : "ok"} />
        </span>
        <span className={`explore__label${isRunning ? " explore__label--active" : ""}`}>{t("exploreLabel")}</span>
        <span className="explore__sep" aria-hidden="true">
          ·
        </span>
        <span className="explore__summary">
          <AnimatedSummary
            contentKey={summaryKey}
            enabled={!open}
            primary={<span className="explore__summary-text">{summaryText}</span>}
          />
        </span>
        <span className="explore__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="explore__body-anim"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={reducedMotion ? { duration: 0 } : COLLAPSE_TRANSITION}
          >
            <div className="explore__body">
              {tools.map((tool) => (
                <FlowToolRow
                  key={tool.id}
                  tool={tool}
                  cwd={cwd}
                  onDrillDown={onDrillDown}
                  onOpenAgentDiff={onOpenAgentDiff}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
