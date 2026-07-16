import React, { useMemo, useState } from "react";
import type { HistoryItem } from "../types.js";
import { ChevronRightIcon } from "../../Icons/icons.js";
import { AgentToolView } from "../../AgentToolView/AgentToolView.js";

export function ToolGroup({ items, cwd }: { items: HistoryItem[]; cwd?: string }): React.ReactElement {
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      const name = item.toolName ?? "tool";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const isAnalysisGroup = useMemo(() => {
    const analysisTools = new Set(["read_file", "view_file", "search_codebase", "grep_search", "list_dir", "agent"]);
    return items.every((item) => analysisTools.has(item.toolName ?? ""));
  }, [items]);

  const toolNameToLabel: Record<string, { one: string; other: string }> = {
    read_file: { one: "file", other: "files" },
    view_file: { one: "file", other: "files" },
    search_codebase: { one: "search", other: "searches" },
    grep_search: { one: "search", other: "searches" },
    write_file: { one: "write", other: "writes" },
    edit_file: { one: "edit", other: "edits" },
    bash: { one: "run", other: "runs" },
    run_command: { one: "run", other: "runs" },
    list_dir: { one: "folder", other: "folders" },
    agent: { one: "exploration", other: "explorations" },
  };

  const hasPending = items.some((item) => item.ok === undefined);

  const pluralizeCount = (count: number, name: string): string => {
    const label = toolNameToLabel[name];
    const suffix = label ? (count === 1 ? label.one : label.other) : name;
    return `${count} ${suffix}`;
  };

  const parts: string[] = [];
  for (const [name, count] of counts) {
    parts.push(pluralizeCount(count, name));
  }
  const summary = parts.join(", ");

  return (
    <div className="tool-group">
      <div
        className="tool-group__header"
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <span className={`tool-group__label${hasPending ? " tool-group__label--pending" : ""}`}>
          {isAnalysisGroup ? "Exploring" : "Changes"}
        </span>
        <span className="tool-group__summary">{summary}</span>
        <span className="tool-group__chevron">
          <ChevronRightIcon open={open} />
        </span>
      </div>
      <div className={`tool-group__tools${open ? "" : " tool-group__tools--hidden"}`}>
        {items.map((item) => (
          <AgentToolView key={item.id} item={item} cwd={cwd} />
        ))}
      </div>
    </div>
  );
}
