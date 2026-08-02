import React from "react";
import { useI18n } from "@/shared/i18n/useI18n";
import type { HistoryItem } from "../../model/history";
import { AgentToolView } from "../AgentToolView/AgentToolView";
import "./SubAgentView.css";

interface Props {
  items: HistoryItem[];
  onBack: () => void;
  cwd?: string;
}

export function SubAgentView({ items, onBack, cwd }: Props): React.ReactElement {
  const { t } = useI18n();
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  return (
    <div className="subagent-view">
      <div className="subagent-view__body" ref={ref}>
        {items.map((item) => {
          if (item.kind === "tool") {
            return <AgentToolView key={item.id} item={item} cwd={cwd} />;
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
          <span className="subagent-view__bar-text">{t("subagentReadOnly")}</span>
          <button className="subagent-view__bar-link" onClick={onBack}>
            {t("goBack")}
          </button>
        </div>
      </div>
    </div>
  );
}
