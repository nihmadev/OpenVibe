import type React from "react";
import { CheckCircleIcon, FailIcon, SpinIcon } from "@/shared/icons/icons";
import type { HistoryItem } from "../../../model/history";
import { describe } from "../../../model/historyUtils";
import { FileBadge } from "./FileBadge";

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
          <span className="tool__suffix" title={suffix}>
            {" "}
            {suffix}
          </span>
        ) : null}
      </span>
    </div>
  );
}
