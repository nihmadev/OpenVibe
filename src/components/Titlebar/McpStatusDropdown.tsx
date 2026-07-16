import React from "react";
import type { McpServerStatus } from "../../types.js";
import { Server, RefreshCw, Settings as SettingsIcon } from "lucide-react";
import { useTranslate } from "../../hooks/useI18n.js";
import "./Titlebar.css";

interface McpStatusDropdownProps {
  servers: McpServerStatus[];
  onToggleServer: (name: string, enable: boolean) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
}

export function McpStatusDropdown({
  servers,
  onToggleServer,
  onOpenSettings,
  onRefresh,
}: McpStatusDropdownProps): React.ReactElement {
  const t = useTranslate();

  const getStatusDotClass = (server: McpServerStatus) => {
    if (!server.enabled) return "titlebar__mcp-dot--gray";
    if (server.status.type === "error") return "titlebar__mcp-dot--red";
    if (server.status.type === "starting") return "titlebar__mcp-dot--starting";
    if (server.status.type === "running") return "titlebar__mcp-dot--green";
    if (server.status.type === "stopped") return "titlebar__mcp-dot--yellow";
    return "titlebar__mcp-dot--gray";
  };

  return (
    <div className="titlebar__mcp-dropdown">
      <div className="titlebar__mcp-header">
        <div className="titlebar__mcp-header-title">
          <Server size={14} />
          <span>{t("mcpServersCount", { count: String(servers.length) })}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <button className="titlebar__mcp-refresh-btn" onClick={onOpenSettings} title={t("mcpOpenSettings")}>
            <SettingsIcon size={14} />
          </button>
          <button className="titlebar__mcp-refresh-btn" onClick={onRefresh} title={t("mcpRefreshStatuses")}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="titlebar__mcp-server-list">
        {servers.length === 0 ? (
          <div className="titlebar__mcp-empty">{t("mcpNoServersConfigured")}</div>
        ) : (
          servers.map((server) => {
            return (
              <div key={server.name} className="titlebar__mcp-server-item">
                <div className="titlebar__mcp-server-info">
                  <span className={`titlebar__mcp-dot ${getStatusDotClass(server)}`} />
                  <span className="titlebar__mcp-server-name">{server.name}</span>
                </div>

                <button
                  type="button"
                  className={`mcp-switch ${server.enabled ? "mcp-switch--active" : ""}`}
                  onClick={() => onToggleServer(server.name, !server.enabled)}
                  aria-checked={server.enabled}
                  role="switch"
                  title={server.enabled ? t("mcpStopServer") : t("mcpStartServer")}
                >
                  <span className="mcp-switch__thumb" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
