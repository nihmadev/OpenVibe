import React from "react";
import type { HistoryItem } from "../AgentChat/types.js";
import { AgentToolView } from "../AgentToolView/AgentToolView.js";
import "./SubAgentView.css";

interface Props {
  items: HistoryItem[];
  onBack: () => void;
}

export function SubAgentView({ items, onBack }: Props): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items]);

  return (
    <div className="subagent-view">
      <div className="subagent-view__body" ref={ref}>
        {items.map((item) => {
          if (item.kind === "tool") {
            return <AgentToolView key={item.id} item={item} />;
          }
          if (item.kind === "assistant") {
            return (
              <div key={item.id} className="subagent-view__chunk">
                {item.text}
              </div>
            );
          }
          if (item.kind === "info") {
            return (
              <div key={item.id} className="subagent-view__info">
                {item.text}
              </div>
            );
          }
          return null;
        })}
      </div>

      <div className="subagent-view__footer">
        <div className="subagent-view__bar">
          <span className="subagent-view__bar-text">Запись не поддерживается.</span>
          <button className="subagent-view__bar-link" onClick={onBack}>
            Вернуться
          </button>
        </div>
      </div>
    </div>
  );
}
