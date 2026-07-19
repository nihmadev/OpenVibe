import React, { useMemo, useState } from "react";
import {
  Bot,
  BookOpen,
  ChevronDown,
  ClipboardList,
  FolderOpen,
  Pencil,
  Search,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { useI18n } from "../../../hooks/useI18n.js";
import { AgentToolView } from "../../AgentToolView/AgentToolView.js";
import { summarizeToolActivities, toolActivityKind } from "../agentRunModel.js";
import type { HistoryItem } from "../types.js";

interface ActivityGroupProps {
  items: HistoryItem[];
  cwd?: string;
  onDrillDown?: (id: string) => void;
}

function ActivityIcon({ item }: { item: HistoryItem }): React.ReactElement {
  const props = { size: 14, strokeWidth: 1.7, "aria-hidden": true } as const;
  if (item.toolName?.startsWith("git_")) {
    return <img src="/icons/providers/github.svg" width={14} height={14} alt="" aria-hidden="true" />;
  }
  switch (toolActivityKind(item)) {
    case "search":
      return <Search {...props} />;
    case "read":
      return <BookOpen {...props} />;
    case "edit":
      return <Pencil {...props} />;
    case "command":
      return <SquareTerminal {...props} />;
    case "browse":
      return <FolderOpen {...props} />;
    case "agent":
      return <Bot {...props} />;
    case "todo":
      return <ClipboardList {...props} />;
    default:
      return <Wrench {...props} />;
  }
}

export function ActivityGroup({ items, cwd, onDrillDown }: ActivityGroupProps): React.ReactElement {
  const { t } = useI18n();
  const hasPending = items.some((item) => item.ok === undefined);
  const [open, setOpen] = useState(true);
  // Keep a burst of completed tool calls readable. Results are already
  // available, so this only paces their presentation in the chat timeline.
  const [visibleCount, setVisibleCount] = useState(0);
  const summary = useMemo(() => summarizeToolActivities(items, t), [items, t]);

  React.useEffect(() => {
    const revealTimer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(items.length, Math.max(1, count + 1)));
      interval = window.setInterval(() => {
        setVisibleCount((count) => {
          if (count >= items.length) {
            if (interval !== undefined) window.clearInterval(interval);
            return count;
          }
          return count + 1;
        });
      }, 140);
    }, 70);
    let interval: number | undefined;
    setVisibleCount((count) => Math.min(count, items.length));

    return () => {
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [items.length]);

  return (
    <section className="activity-group">
      <button
        className={`activity-group__header${hasPending ? " activity-group__header--pending" : ""}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="activity-group__icon">
          <ActivityIcon item={items[0]!} />
        </span>
        <span className="activity-group__title">{summary}</span>
        <ChevronDown className="activity-group__chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="activity-group__items">
          {items.slice(0, visibleCount).map((item, index) => (
            <div
              className="agent-run__tool activity-group__item-enter"
              style={{ "--activity-index": index } as React.CSSProperties}
              key={item.id}
            >
              <AgentToolView item={item} cwd={cwd} onDrillDown={onDrillDown} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
