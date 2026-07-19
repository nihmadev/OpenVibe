import React, { useState, useEffect } from "react";
import { useTranslate } from "../../hooks/useI18n.js";
import { Toggle } from "../ui/index.js";
import { Loader2Icon } from "../Icons/index.js";
import { invoke } from "@tauri-apps/api/core";
import { lspStore, type LspServerItem } from "./lspStore.js";

export function LspTab(): React.ReactElement {
  const t = useTranslate();
  const [servers, setServers] = useState<LspServerItem[]>(lspStore.getServers());

  useEffect(() => {
    const unsubscribe = lspStore.subscribe(setServers);

    async function fetchServers() {
      try {
        const [backendServers, runningServers] = await Promise.all([
          invoke<any[]>("get_lsp_servers"),
          invoke<string[]>("lsp_running_servers"),
        ]);
        const currentServers = lspStore.getServers();

        const mapped = backendServers.map((s) => {
          const existing = currentServers.find((c) => c.id === s.id);
          const running = runningServers.includes(s.id);
          if (existing) {
            return { ...existing, enabled: running, status: running ? ("running" as const) : existing.status };
          }
          return {
            id: s.id,
            name: s.name,
            enabled: running,
            status: running ? ("running" as const) : ("stopped" as const),
          };
        });
        lspStore.setServers(mapped);
      } catch (err) {
        console.error("Failed to fetch LSP servers", err);
      }
    }
    fetchServers();

    return unsubscribe;
  }, []);

  const toggleServer = async (id: string, enable: boolean) => {
    if (!enable) {
      const updated = lspStore
        .getServers()
        .map((s) => (s.id === id ? { ...s, enabled: false, status: "stopped" as const } : s));
      lspStore.setServers(updated);
      return;
    }

    lspStore.setServers(lspStore.getServers().map((s) => (s.id === id ? { ...s, status: "installing" as const } : s)));
    try {
      await invoke("lsp_start_server", { id });
      lspStore.setServers(
        lspStore.getServers().map((s) => (s.id === id ? { ...s, enabled: true, status: "running" as const } : s)),
      );
    } catch (e) {
      console.error("Failed to start server", e);
      lspStore.setServers(
        lspStore.getServers().map((s) => (s.id === id ? { ...s, enabled: false, status: "error" as const } : s)),
      );
    }
  };

  const isInstalling = servers.some((s) => s.status === "installing");

  const getStatusDotClass = (server: LspServerItem) => {
    if (server.status === "error") return "titlebar__mcp-dot--red";
    if (server.status === "running") return "titlebar__mcp-dot--green";
    return "titlebar__mcp-dot--gray";
  };

  return (
    <div className="servers-panel__lsp">
      <div className={`titlebar__mcp-header ${isInstalling ? "installing" : ""}`}>
        <div className="titlebar__mcp-header-title">
          <span>LSP Servers ({servers.length})</span>
        </div>
      </div>

      <div className="titlebar__mcp-server-list">
        {servers.map((server) => (
          <div key={server.id} className="titlebar__mcp-server-item">
            <div className="titlebar__mcp-server-info">
              <span className={`titlebar__mcp-dot ${getStatusDotClass(server)}`} />
              <span className="titlebar__mcp-server-name">{server.name}</span>
            </div>

            {server.status === "installing" ? (
              <div className="lsp-spinner">
                <Loader2Icon />
              </div>
            ) : (
              <Toggle
                checked={server.enabled}
                onValueChange={(checked) => toggleServer(server.id, checked)}
                title={server.enabled ? "Stop LSP Server" : "Start LSP Server"}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
