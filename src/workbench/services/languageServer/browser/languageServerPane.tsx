import { Toggle } from "@zazaru/ui";
import type React from "react";
import { useEffect, useState } from "react";
import { Loader2Icon } from "@/base/browser/ui/icons/iconRegistry";
import type { LspServerItem } from "../common/languageServer";
import { languageServerService } from "../tauri/languageServerService";
import { languageServerStore } from "./languageServerStore";

export function LanguageServerPane(): React.ReactElement {
  const [servers, setServers] = useState<LspServerItem[]>(languageServerStore.getServers());

  useEffect(() => {
    const unsubscribe = languageServerStore.subscribe(setServers);

    async function fetchServers() {
      try {
        const [backendServers, runningServers] = await Promise.all([
          languageServerService.listServers(),
          languageServerService.runningServers(),
        ]);
        const currentServers = languageServerStore.getServers();

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
        languageServerStore.setServers(mapped);
      } catch (err) {
        console.error("Failed to fetch LSP servers", err);
      }
    }
    fetchServers();

    return unsubscribe;
  }, []);

  const toggleServer = async (id: string, enable: boolean) => {
    if (!enable) {
      const updated = languageServerStore
        .getServers()
        .map((s) => (s.id === id ? { ...s, enabled: false, status: "stopped" as const } : s));
      languageServerStore.setServers(updated);
      return;
    }

    languageServerStore.setServers(
      languageServerStore.getServers().map((s) => (s.id === id ? { ...s, status: "installing" as const } : s)),
    );
    try {
      await languageServerService.startServer(id);
      languageServerStore.setServers(
        languageServerStore
          .getServers()
          .map((s) => (s.id === id ? { ...s, enabled: true, status: "running" as const } : s)),
      );
    } catch (e) {
      console.error("Failed to start server", e);
      languageServerStore.setServers(
        languageServerStore
          .getServers()
          .map((s) => (s.id === id ? { ...s, enabled: false, status: "error" as const } : s)),
      );
    }
  };

  const getStatusDotClass = (server: LspServerItem) => {
    if (server.status === "error") return "error";
    if (server.status === "running") return "running";
    return "idle";
  };

  return (
    <div className="mcp-status-dropdown__lsp">
      <div className="mcp-status-dropdown__list">
        {servers.map((server) => (
          <div key={server.id} className="z-interactive-item mcp-status-dropdown__row">
            <span className={`mcp-status-dropdown__dot mcp-status-dropdown__dot--${getStatusDotClass(server)}`} />
            <div className="mcp-status-dropdown__server">
              <span className="mcp-status-dropdown__name">{server.name}</span>
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
