import type React from "react";
import { CheckCircleIcon, FailIcon, SpinIcon } from "@/base/browser/ui/icons/iconRegistry";
import type { HistoryItem } from "@/workbench/common/conversation";
import { describe } from "@/workbench/services/agent/common/agentToolPresentation";
import { FileBadge } from "./fileBadge";

export function ToolBlock({ item }: { item: HistoryItem }): React.ReactElement {
  const { verb, file, suffix } = describe(item);
  const stateCls = item.ok === undefined ? "tool--pending" : item.ok ? "tool--ok" : "tool--err";

  return (
    <div className={`tool ${stateCls}`}>
      <span className="tool__icon">
        {item.ok === undefined ? <SpinIcon /> : item.ok ? <CheckCircleIcon /> : <FailIcon />}
      </span>
      <span className="tool__line">
        <span className="tool__verb">{verb}</span>
        {file ? (
          <>
            {" "}
            <FileBadge info={file} />
          </>
        ) : null}
        {suffix ? (
          <span className={suffix.startsWith("#L") ? "tool__lines" : "tool__suffix"} title={suffix}>
            {" "}
            {suffix}
          </span>
        ) : null}
      </span>
    </div>
  );
}
