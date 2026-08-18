import { Button, Input, Toggle } from "@zazaru/ui";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircleIcon,
  DotsHorizontalIcon,
  DownloadIcon,
  Edit2Icon,
  PlusStrokeIcon,
  RefreshCwStrokeIcon,
  ServerIcon,
  Trash2Icon,
  TrashIcon,
  UploadStrokeIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { useTranslate } from "@/platform/localization/localizationService";
import type { McpConfig, McpServerConfig, McpServerStatus } from "../common/mcp";
import { mcpGetConfig, mcpGetServers, mcpSaveConfig, mcpStartServer, mcpStopServer } from "../tauri/mcpService";

export function McpSettingsPane(): React.ReactElement {
  const t = useTranslate();
  const [config, setConfig] = useState<McpConfig>({ servers: [] });
  const [statuses, setStatuses] = useState<McpServerStatus[]>([]);
  const [rawToml, setRawToml] = useState<string>("");
  const [isRawMode, setIsRawMode] = useState<boolean>(false);

  const [editingServer, setEditingServer] = useState<McpServerConfig | null>(null);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  // Form states for Add/Edit
  const [formName, setFormName] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formArgs, setFormArgs] = useState("");
  const [formEnv, setFormEnv] = useState<{ key: string; value: string }[]>([]);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formError, setFormError] = useState("");

  const getServers = useCallback((cfg?: McpConfig | null): McpServerConfig[] => {
    if (!cfg) return [];
    return cfg.servers || (cfg as any).server || [];
  }, []);

  const loadData = useCallback(async () => {
    try {
      const cfg = await mcpGetConfig();
      const servers = getServers(cfg);
      setConfig({ servers });
      const st = await mcpGetServers();
      setStatuses(st || []);

      // Format raw TOML representation
      let tomlStr = "[mcp]\n\n";
      for (const s of servers) {
        tomlStr += `[[mcp.server]]\nname = "${s.name}"\ncommand = "${s.command}"\nargs = ${JSON.stringify(s.args || [])}\n`;
        if (s.env && Object.keys(s.env).length > 0) {
          tomlStr += `env = ${JSON.stringify(s.env)}\n`;
        }
        tomlStr += `enabled = ${s.enabled}\n\n`;
      }
      setRawToml(tomlStr);
    } catch (e) {
      console.error("Failed to load MCP data:", e);
    }
  }, [getServers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleServer = async (name: string, enable: boolean) => {
    const serversList = getServers(config);
    const updatedServers = serversList.map((s) => (s.name === name ? { ...s, enabled: enable } : s));
    const newConfig = { ...config, servers: updatedServers };
    setConfig(newConfig);
    try {
      await mcpSaveConfig(newConfig);
      if (enable) {
        await mcpStartServer(name);
      } else {
        await mcpStopServer(name);
      }
      loadData();
    } catch (e) {
      console.error("Failed to toggle MCP server:", e);
    }
  };

  const openAddModal = () => {
    setEditingServer(null);
    setFormName("");
    setFormCommand("");
    setFormArgs("");
    setFormEnv([]);
    setFormEnabled(true);
    setFormError("");
    setIsAdding(true);
  };

  const openEditModal = (server: McpServerConfig) => {
    setEditingServer(server);
    setFormName(server.name);
    setFormCommand(server.command);
    setFormArgs((server.args || []).join(" "));
    setFormEnv(Object.entries(server.env || {}).map(([key, value]) => ({ key, value })));
    setFormEnabled(server.enabled);
    setFormError("");
    setIsAdding(true);
  };

  const handleDeleteServer = async (name: string) => {
    if (!confirm(t("mcpDeleteConfirm", { name }))) return;
    const serversList = getServers(config);
    const updatedServers = serversList.filter((s) => s.name !== name);
    const newConfig = { ...config, servers: updatedServers };
    try {
      await mcpStopServer(name);
      await mcpSaveConfig(newConfig);
      loadData();
    } catch (e) {
      console.error("Failed to delete MCP server:", e);
    }
  };

  const handleSaveForm = async () => {
    if (!formName.trim()) {
      setFormError(t("mcpServerNameRequired"));
      return;
    }
    if (!formCommand.trim()) {
      setFormError(t("mcpServerCommandRequired"));
      return;
    }

    const serversList = getServers(config);
    // Check duplicate name if adding or renaming
    if (!editingServer || editingServer.name !== formName.trim()) {
      if (serversList.some((s) => s.name.toLowerCase() === formName.trim().toLowerCase())) {
        setFormError(t("mcpServerExists"));
        return;
      }
    }

    const argsList = formArgs
      .trim()
      .split(/\s+/)
      .filter((a) => a.length > 0);

    const envMap: Record<string, string> = {};
    for (const item of formEnv) {
      if (item.key.trim()) {
        envMap[item.key.trim()] = item.value;
      }
    }

    const serverObj: McpServerConfig = {
      name: formName.trim(),
      command: formCommand.trim(),
      args: argsList,
      env: envMap,
      enabled: formEnabled,
    };

    let updatedServers: McpServerConfig[];
    if (editingServer) {
      updatedServers = serversList.map((s) => (s.name === editingServer.name ? serverObj : s));
    } else {
      updatedServers = [...serversList, serverObj];
    }

    const newConfig = { ...config, servers: updatedServers };
    try {
      await mcpSaveConfig(newConfig);
      setIsAdding(false);
      loadData();
    } catch (e) {
      setFormError(t("mcpSaveFailed", { error: String(e) }));
    }
  };

  const handleSaveRawToml = async () => {
    try {
      // Simple parse validation check
      const newServers: McpServerConfig[] = [];
      const blocks = rawToml.split("[[mcp.server]]");
      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const nameMatch = block.match(/name\s*=\s*"([^"]+)"/);
        const cmdMatch = block.match(/command\s*=\s*"([^"]+)"/);
        if (nameMatch && cmdMatch) {
          newServers.push({
            name: nameMatch[1],
            command: cmdMatch[1],
            args: [],
            env: {},
            enabled: !block.includes("enabled = false"),
          });
        }
      }
      await mcpSaveConfig({ servers: newServers });
      loadData();
      setIsRawMode(false);
    } catch (e) {
      alert(t("mcpInvalidConfigFormat", { error: String(e) }));
    }
  };

  const handleExport = () => {
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(config, null, 2))}`;
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "mcp-config.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const imported = JSON.parse(content);
        if (Array.isArray(imported.servers) || Array.isArray(imported.server)) {
          const servers = imported.servers || imported.server;
          await mcpSaveConfig({ servers });
          loadData();
        } else {
          alert(t("mcpInvalidJsonFormat"));
        }
      } catch (_err) {
        alert(t("mcpFailedParseJson"));
      }
    };
    reader.readAsText(file);
  };

  const getStatusMeta = (server: McpServerConfig) => {
    if (!server.enabled) {
      return { dotClass: "mcp-dot--gray", label: t("mcpStatusDisabled") };
    }

    const name = server.name;
    const st = statuses.find((s) => s.name === name);
    if (!st?.enabled) {
      return { dotClass: "mcp-dot--gray", label: t("mcpStatusStopped") };
    }

    const statusType = typeof st.status === "string" ? st.status : st.status.type;
    if (statusType === "running") return { dotClass: "mcp-dot--green", label: t("mcpStatusRunning") };
    if (statusType === "starting") return { dotClass: "mcp-dot--starting", label: t("mcpStatusStarting") };
    if (statusType === "stopped") return { dotClass: "mcp-dot--yellow", label: t("mcpStatusStopped") };
    return { dotClass: "mcp-dot--red", label: t("mcpStatusError") };
  };

  const closeMenu = (target: HTMLElement) => {
    const details = target.closest("details");
    if (details) details.open = false;
  };

  const currentServers = getServers(config);

  return (
    <div className="mcp-panel">
      <div className="mcp-panel__toolbar">
        <div className="mcp-panel__tabs" role="tablist" aria-label={t("mcpServers")}>
          <button
            className={`mcp-panel__tab${!isRawMode ? " mcp-panel__tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={!isRawMode}
            onClick={() => setIsRawMode(false)}
          >
            {t("mcpServers")} <span>{currentServers.length}</span>
          </button>
          <button
            className={`mcp-panel__tab${isRawMode ? " mcp-panel__tab--active" : ""}`}
            type="button"
            role="tab"
            aria-selected={isRawMode}
            onClick={() => setIsRawMode(true)}
          >
            {t("mcpConfiguration")}
          </button>
        </div>

        <div className="mcp-panel__toolbar-actions">
          <button className="mcp-panel__secondary-action" type="button" onClick={() => loadData()}>
            <RefreshCwStrokeIcon size={13} />
            {t("mcpRefreshStatuses")}
          </button>
          <details className="mcp-menu">
            <summary className="mcp-panel__icon-action" aria-label={`${t("mcpExport")} / ${t("mcpImport")}`}>
              <DotsHorizontalIcon size={14} />
            </summary>
            <div className="mcp-menu__popover mcp-menu__popover--toolbar">
              <button
                className="mcp-menu__item"
                type="button"
                onClick={(event) => {
                  handleExport();
                  closeMenu(event.currentTarget);
                }}
              >
                <DownloadIcon size={13} />
                {t("mcpExport")}
              </button>
              <label className="mcp-menu__item">
                <UploadStrokeIcon size={13} />
                {t("mcpImport")}
                <input
                  type="file"
                  accept=".json"
                  onChange={(event) => {
                    closeMenu(event.currentTarget);
                    handleImport(event);
                  }}
                  hidden
                />
              </label>
            </div>
          </details>
          <button className="mcp-panel__primary-action" type="button" onClick={openAddModal}>
            <PlusStrokeIcon size={13} />
            {t("mcpAddServer")}
          </button>
        </div>
      </div>

      {isRawMode ? (
        <div className="mcp-panel__raw">
          <textarea
            className="mcp-panel__raw-editor"
            value={rawToml}
            onChange={(e) => setRawToml(e.target.value)}
            spellCheck={false}
            placeholder={`[mcp]

[[mcp.server]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
enabled = true`}
          />
          <Button variant="primary" onClick={handleSaveRawToml}>
            {t("mcpSaveTomlConfig")}
          </Button>
        </div>
      ) : (
        <div className="mcp-panel__server-list">
          {currentServers.length === 0 ? (
            <div className="mcp-panel__empty">{t("mcpNoServersConfigured")}</div>
          ) : (
            currentServers.map((server) => {
              const status = getStatusMeta(server);
              const command = [server.command, ...(server.args || [])].filter(Boolean).join(" ");
              return (
                <div key={server.name} className="mcp-panel__server-row">
                  <div className="mcp-panel__server-main">
                    <div className="mcp-panel__server-icon">
                      <ServerIcon size={16} />
                    </div>
                    <div className="mcp-panel__server-copy">
                      <div className="mcp-panel__server-name">{server.name}</div>
                      <div className="mcp-panel__server-command" title={command}>
                        {command}
                      </div>
                    </div>
                  </div>
                  <div className="mcp-panel__status">
                    <span className={`mcp-dot ${status.dotClass}`} />
                    {status.label}
                  </div>
                  <Toggle
                    checked={server.enabled}
                    onValueChange={(checked) => handleToggleServer(server.name, checked)}
                    title={server.enabled ? t("mcpDisableServer") : t("mcpEnableServer")}
                  />
                  <details className="mcp-menu mcp-menu--row">
                    <summary className="mcp-panel__row-menu-trigger" aria-label={server.name}>
                      <DotsHorizontalIcon size={14} />
                    </summary>
                    <div className="mcp-menu__popover">
                      <button
                        className="mcp-menu__item"
                        type="button"
                        onClick={(event) => {
                          closeMenu(event.currentTarget);
                          openEditModal(server);
                        }}
                      >
                        <Edit2Icon size={13} />
                        {t("edit")}
                      </button>
                      <button
                        className="mcp-menu__item mcp-menu__item--danger"
                        type="button"
                        onClick={(event) => {
                          closeMenu(event.currentTarget);
                          handleDeleteServer(server.name);
                        }}
                      >
                        <Trash2Icon size={13} />
                        {t("delete")}
                      </button>
                    </div>
                  </details>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Server Modal */}
      {isAdding && (
        <div className="connect-popup__overlay" onClick={() => setIsAdding(false)}>
          <div className="connect-popup mcp-connect-popup" onClick={(e) => e.stopPropagation()}>
            <div className="connect-popup__header">
              <h2 className="connect-popup__title">
                {editingServer ? t("mcpEditServerTitle") : t("mcpAddServerTitle")}
              </h2>
              <button className="connect-popup__close" onClick={() => setIsAdding(false)}>
                ×
              </button>
            </div>

            <div className="connect-popup__body">
              {formError && (
                <div className="mcp-connect-popup__error">
                  <AlertCircleIcon size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="connect-popup__section">
                <label className="connect-popup__label">{t("mcpServerName")}</label>
                <Input
                  containerClassName="connect-popup__input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="filesystem"
                />
              </div>

              <div className="mcp-connect-popup__command-grid">
                <div className="connect-popup__section">
                  <label className="connect-popup__label">{t("mcpCommand")}</label>
                  <Input
                    containerClassName="connect-popup__input"
                    value={formCommand}
                    onChange={(e) => setFormCommand(e.target.value)}
                    placeholder={t("mcpCommandPlaceholder")}
                  />
                </div>

                <div className="connect-popup__section">
                  <label className="connect-popup__label">{t("mcpArgumentsShort")}</label>
                  <Input
                    containerClassName="connect-popup__input"
                    value={formArgs}
                    onChange={(e) => setFormArgs(e.target.value)}
                    placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                  />
                </div>
              </div>

              <div className="connect-popup__section">
                <div className="connect-popup__section-header">
                  <label className="connect-popup__label">{t("mcpEnvVariables")}</label>
                </div>
                <div className="connect-popup__pairs">
                  {formEnv.map((item, idx) => (
                    <div key={idx} className="connect-popup__pair-row">
                      <Input
                        containerClassName="connect-popup__input connect-popup__pair-key"
                        value={item.key}
                        onChange={(e) => {
                          const updated = [...formEnv];
                          updated[idx].key = e.target.value;
                          setFormEnv(updated);
                        }}
                        placeholder={t("mcpEnvKeyPlaceholder")}
                      />
                      <Input
                        containerClassName="connect-popup__input connect-popup__pair-value"
                        value={item.value}
                        onChange={(e) => {
                          const updated = [...formEnv];
                          updated[idx].value = e.target.value;
                          setFormEnv(updated);
                        }}
                        placeholder={t("mcpEnvValuePlaceholder")}
                      />
                      <button
                        className="connect-popup__icon-btn"
                        type="button"
                        onClick={() => setFormEnv(formEnv.filter((_, i) => i !== idx))}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  ))}
                  <button
                    className="connect-popup__add-pair-btn"
                    type="button"
                    onClick={() => setFormEnv([...formEnv, { key: "", value: "" }])}
                  >
                    {t("mcpAddEnvVar")}
                  </button>
                </div>
              </div>

              <div className="mcp-connect-popup__startup">
                <label className="connect-popup__label">{t("mcpEnableOnStartup")}</label>
                <Toggle checked={formEnabled} onValueChange={setFormEnabled} />
              </div>
            </div>

            <div className="connect-popup__footer">
              <Button variant="outline" onClick={() => setIsAdding(false)}>
                {t("cancel")}
              </Button>
              <Button variant="primary" onClick={handleSaveForm}>
                {t("mcpSaveServer")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
