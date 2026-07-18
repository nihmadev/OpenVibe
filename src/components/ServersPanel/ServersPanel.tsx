import React, { useState } from "react";
import { Server, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { useTranslate } from "../../hooks/useI18n.js";
import { Toggle } from "../ui/index.js";
import type { McpServerStatus } from "../../types.js";
import { LspTab } from "./LspTab.js";
import "./ServersPanel.css";
import "../Terminals/Terminals.css"; // Reuse termtabs styles

interface ServersPanelProps {
  mcpServers: McpServerStatus[];
  onToggleMcpServer: (name: string, enable: boolean) => void;
  onOpenSettings: () => void;
  onRefreshMcp: () => void;
}

export function ServersPanel({
  mcpServers,
  onToggleMcpServer,
  onOpenSettings,
  onRefreshMcp,
}: ServersPanelProps): React.ReactElement {
  const t = useTranslate();
  const [activeTab, setActiveTab] = useState<"mcp" | "lsp">("mcp");

  const getStatusDotClass = (server: McpServerStatus) => {
    if (!server.enabled) return "titlebar__mcp-dot--gray";
    if (server.status.type === "error") return "titlebar__mcp-dot--red";
    if (server.status.type === "starting") return "titlebar__mcp-dot--starting";
    if (server.status.type === "running") return "titlebar__mcp-dot--green";
    if (server.status.type === "stopped") return "titlebar__mcp-dot--yellow";
    return "titlebar__mcp-dot--gray";
  };

  return (
    <div className="servers-panel">
      <div className="termtabs servers-panel__tabs">
        <div
          className={`termtabs__tab ${activeTab === "mcp" ? "termtabs__tab--active" : ""}`}
          onClick={() => setActiveTab("mcp")}
        >
          <span className="termtabs__title">MCP</span>
        </div>
        <div
          className={`termtabs__tab ${activeTab === "lsp" ? "termtabs__tab--active" : ""}`}
          onClick={() => setActiveTab("lsp")}
        >
          <span className="termtabs__title">LSP</span>
        </div>
      </div>

      <div className="servers-panel__content">
        {activeTab === "mcp" && (
          <div className="servers-panel__mcp">
            <div className="titlebar__mcp-header">
              <div className="titlebar__mcp-header-title">
                <Server size={14} />
                <span>{t("mcpServersCount", { count: String(mcpServers.length) })}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <button className="titlebar__mcp-refresh-btn" onClick={onOpenSettings} title={t("mcpOpenSettings")}>
                  <SettingsIcon size={14} />
                </button>
                <button className="titlebar__mcp-refresh-btn" onClick={onRefreshMcp} title={t("mcpRefreshStatuses")}>
                  <RefreshCw size={14} />
                </button>
              </div>
            </div>

            <div className="titlebar__mcp-server-list">
              {mcpServers.length === 0 ? (
                <div className="titlebar__mcp-empty">{t("mcpNoServersConfigured")}</div>
              ) : (
                mcpServers.map((server) => (
                  <div key={server.name} className="titlebar__mcp-server-item">
                    <div className="titlebar__mcp-server-info">
                      <span className={`titlebar__mcp-dot ${getStatusDotClass(server)}`} />
                      <span className="titlebar__mcp-server-name">{server.name}</span>
                    </div>

                    <Toggle
                      checked={server.enabled}
                      onValueChange={(checked) => onToggleMcpServer(server.name, checked)}
                      title={server.enabled ? t("mcpStopServer") : t("mcpStartServer")}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "lsp" && <LspTab />}
      </div>
    </div>
  );
}
