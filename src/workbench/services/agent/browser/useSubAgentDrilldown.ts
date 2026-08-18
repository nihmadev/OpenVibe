// Sub-agent drill-down: load a nested trace and map it into history items.
import { useCallback, useState } from "react";
import { localId } from "@/base/common/localId";
import type { HistoryItem } from "@/workbench/common/conversation";
import { agentService } from "../tauri/agentService";

export function useSubAgentDrilldown(items: HistoryItem[]) {
  const [drillDownId, setDrillDownId] = useState<string | null>(null);
  const [drillItems, setDrillItems] = useState<HistoryItem[]>([]);

  const drillDown = useCallback(
    async (id: string) => {
      const item = items.find((it) => it.id === id);
      if (!item) return;
      setDrillDownId(id);

      if (item.subItems && item.subItems.length > 0) {
        setDrillItems(item.subItems);
        return;
      }

      try {
        const trace = await agentService.getSubTrace(id);
        const historyItems: HistoryItem[] = trace.map((ev) => {
          if (ev.kind === "chunk") {
            return { id: localId(), kind: "assistant" as const, text: ev.text ?? "" };
          }
          if (ev.kind === "tool-call") {
            return {
              id: ev.id ?? localId(),
              kind: "tool" as const,
              text: "",
              toolName: ev.name ?? "",
              toolArgs: ev.args ?? {},
            };
          }
          if (ev.kind === "tool-result") {
            return {
              id: ev.id ?? localId(),
              kind: "tool" as const,
              text: ev.text ?? "",
              ok: ev.ok ?? false,
            };
          }
          return { id: localId(), kind: "info" as const, text: "" };
        });
        setDrillItems(historyItems);
      } catch {
        setDrillItems([]);
      }
    },
    [items],
  );

  const drillBack = useCallback(() => {
    setDrillDownId(null);
    setDrillItems([]);
  }, []);

  return { drillDownId, drillItems, drillDown, drillBack };
}
