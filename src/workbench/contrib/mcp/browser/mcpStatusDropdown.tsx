import { IconButton, interactiveItemClassName, Surface, Toggle } from "@zazaru/ui";
import type React from "react";
import { useState } from "react";
import { RefreshCwStrokeIcon, SettingsIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useTranslate } from "@/platform/localization/localizationService";
import type { McpServerStatus } from "../common/mcp";
import "./mcpStatusDropdown.css";
import type { ServerPaneSlot } from "./serverPaneSlot";

interface McpStatusDropdownProps {
  servers: McpServerStatus[];
  onToggleServer: (name: string, enable: boolean) => void;
  onOpenSettings: () => void;
  onRefresh: () => void;
  additionalPane?: ServerPaneSlot;
}

export function McpStatusDropdown({
  servers,
  onToggleServer,
  onOpenSettings,
  onRefresh,
  additionalPane,
}: McpStatusDropdownProps): React.ReactElement {
  const t = useTranslate();

  const [activeTab, setActiveTab] = useState<"mcp" | "additional">("mcp");

  const getStatus = (server: McpServerStatus) => {
    if (!server.enabled) return "idle";
    return server.status.type;
  };

  return (
    <Surface tone="panel" className="mcp-status-dropdown">
      <header className="mcp-status-dropdown__header">
        <div className="mcp-status-dropdown__tabs" role="tablist" aria-label={t("server")}>
          {(["mcp", ...(additionalPane ? (["additional"] as const) : [])] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`mcp-status-dropdown__tab ${activeTab === tab ? "mcp-status-dropdown__tab--active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "mcp" ? "MCP" : additionalPane?.label}
              {tab === "mcp" && <span>{servers.length}</span>}
            </button>
          ))}
        </div>
        <div className="mcp-status-dropdown__actions">
          <IconButton
            scale="compact"
            onClick={onRefresh}
            title={t("mcpRefreshStatuses")}
            aria-label={t("mcpRefreshStatuses")}
          >
            <RefreshCwStrokeIcon size={14} />
          </IconButton>
          <IconButton
            scale="compact"
            onClick={onOpenSettings}
            title={t("mcpOpenSettings")}
            aria-label={t("mcpOpenSettings")}
          >
            <SettingsIcon size={14} strokeWidth={2} />
          </IconButton>
        </div>
      </header>

      <div className="mcp-status-dropdown__content">
        {activeTab === "additional" ? (
          additionalPane?.content
        ) : servers.length === 0 ? (
          <div className="mcp-status-dropdown__empty">{t("mcpNoServersConfigured")}</div>
        ) : (
          <div className="mcp-status-dropdown__list">
            {servers.map((server) => {
              const status = getStatus(server);
              return (
                <div key={server.name} className={interactiveItemClassName(false, "mcp-status-dropdown__row")}>
                  <span className={`mcp-status-dropdown__dot mcp-status-dropdown__dot--${status}`} aria-hidden="true" />
                  <div className="mcp-status-dropdown__server">
                    <span className="mcp-status-dropdown__name" title={server.name}>
                      {server.name}
                    </span>
                  </div>
                  <Toggle
                    checked={server.enabled}
                    onValueChange={(checked) => onToggleServer(server.name, checked)}
                    title={server.enabled ? t("mcpStopServer") : t("mcpStartServer")}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Surface>
  );
}
