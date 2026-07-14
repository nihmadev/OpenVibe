import React, { useState, useEffect } from "react";
import type { McpConfig, McpServerConfig, McpServerStatus } from "../../types.js";
import {
  mcpGetConfig,
  mcpSaveConfig,
  mcpGetServers,
  mcpStartServer,
  mcpStopServer,
} from "../../tauri-bridge.js";
import { Server, Plus, Edit2, Trash2, Sliders, FileCode2, Download, Upload, Check, AlertCircle } from "lucide-react";

import { useTranslate } from "../../hooks/useI18n.js";

export function McpSettingsPanel(): React.ReactElement {
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

  const getServers = (cfg?: McpConfig | null): McpServerConfig[] => {
    if (!cfg) return [];
    return cfg.servers || (cfg as any).server || [];
  };

  const loadData = async () => {
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
  };

  useEffect(() => {
    loadData();
  }, []);

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
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
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
      } catch (err) {
        alert(t("mcpFailedParseJson"));
      }
    };
    reader.readAsText(file);
  };

  const getServerStatusBadge = (name: string) => {
    const st = statuses.find((s) => s.name === name);
    if (!st || !st.enabled) return <span className="mcp-badge mcp-badge--disabled">{t("mcpDisabled")}</span>;
    const statusType = typeof st.status === "string" ? st.status : st.status.type;
    if (statusType === "running") return <span className="mcp-badge mcp-badge--running">{t("mcpRunning")}</span>;
    if (statusType === "stopped") return <span className="mcp-badge mcp-badge--stopped">{t("mcpStopped")}</span>;
    return <span className="mcp-badge mcp-badge--error">{t("mcpErrorStatus")}</span>;
  };

  const currentServers = getServers(config);

  return (
    <div className="mcp-settings">
      <div className="mcp-settings__toolbar">
        <button className="mcp-btn mcp-btn--primary" onClick={openAddModal}>
          <Plus size={14} />
          <span>{t("mcpAddServer")}</span>
        </button>

        <button className="mcp-btn mcp-btn--toggle-mode" onClick={() => setIsRawMode(!isRawMode)}>
          {isRawMode ? <Sliders size={14} /> : <FileCode2 size={14} />}
          <span>{isRawMode ? t("mcpVisualEditor") : t("mcpRawConfig")}</span>
        </button>

        <button className="mcp-btn" onClick={handleExport}>
          <Download size={14} />
          <span>{t("mcpExport")}</span>
        </button>

        <label className="mcp-btn mcp-btn--upload">
          <Upload size={14} />
          <span>{t("mcpImport")}</span>
          <input type="file" accept=".json" onChange={handleImport} hidden />
        </label>
      </div>

      {isRawMode ? (
        <div className="mcp-raw-editor">
          <textarea
            className="mcp-raw-textarea"
            value={rawToml}
            onChange={(e) => setRawToml(e.target.value)}
            placeholder={`[mcp]

[[mcp.server]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
enabled = true

[[mcp.server]]
name = "github"
command = "uvx"
args = ["mcp-server-github"]
env = { GITHUB_TOKEN = "ghp_xxx" }
enabled = false`}
            rows={15}
          />
          <div className="mcp-raw-actions">
            <button className="mcp-btn mcp-btn--primary" onClick={handleSaveRawToml}>
              {t("mcpSaveTomlConfig")}
            </button>
          </div>
        </div>

      ) : (
        <div className="mcp-server-list">
          {currentServers.length === 0 ? (
            <div className="mcp-empty-state">
              <Server size={32} />
              <p>{t("mcpNoServersConfiguredYet")}</p>
              <span>{t("mcpAddServerDesc")}</span>
            </div>
          ) : (
            currentServers.map((server) => {

              const statusObj = statuses.find((s) => s.name === server.name);
              return (
                <div key={server.name} className="mcp-server-card">
                  <div className="mcp-server-card__header">
                    <div className="mcp-server-card__title">
                      <h3>{server.name}</h3>
                      {getServerStatusBadge(server.name)}
                    </div>
                    <div className="mcp-server-card__actions">
                      <button
                        type="button"
                        className={`mcp-switch ${server.enabled ? "mcp-switch--active" : ""}`}
                        onClick={() => handleToggleServer(server.name, !server.enabled)}
                        aria-checked={server.enabled}
                        role="switch"
                        title={server.enabled ? t("mcpDisableServer") : t("mcpEnableServer")}
                      >
                        <span className="mcp-switch__thumb" />
                      </button>

                      <button className="mcp-icon-btn" onClick={() => openEditModal(server)} title={t("edit")}>
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="mcp-icon-btn mcp-icon-btn--danger"
                        onClick={() => handleDeleteServer(server.name)}
                        title={t("delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="mcp-server-card__details">
                    <div className="mcp-detail-row">
                      <span className="mcp-detail-label">{t("mcpCommandLabel")}</span>
                      <code className="mcp-detail-code">
                        {server.command} {(server.args || []).join(" ")}
                      </code>
                    </div>
                    {server.env && Object.keys(server.env).length > 0 && (
                      <div className="mcp-detail-row">
                        <span className="mcp-detail-label">{t("mcpEnvLabel")}</span>
                        <span className="mcp-detail-env">
                          {Object.keys(server.env)
                            .map((k) => `${k}=***`)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                    {statusObj?.error && (
                      <div className="mcp-detail-error">
                        <AlertCircle size={12} />
                        <span>{statusObj.error}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Server Modal */}
      {isAdding && (
        <div className="mcp-modal-overlay" onClick={() => setIsAdding(false)}>
          <div className="mcp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mcp-modal__header">
              <h3>{editingServer ? t("mcpEditServerTitle") : t("mcpAddServerTitle")}</h3>
              <button className="mcp-modal__close" onClick={() => setIsAdding(false)}>
                ×
              </button>
            </div>

            <div className="mcp-modal__body">
              {formError && (
                <div className="mcp-form-error">
                  <AlertCircle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <div className="mcp-form-group">
                <label>{t("mcpServerName")}</label>
                <input
                  type="text"
                  placeholder="filesystem"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="mcp-form-group">
                <label>{t("mcpCommandPath")}</label>
                <input
                  type="text"
                  placeholder={t("mcpCommandPlaceholder")}
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                />
              </div>

              <div className="mcp-form-group">
                <label>{t("mcpArguments")}</label>
                <input
                  type="text"
                  placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                  value={formArgs}
                  onChange={(e) => setFormArgs(e.target.value)}
                />
              </div>

              <div className="mcp-form-group">
                <label>{t("mcpEnvVariables")}</label>
                {formEnv.map((item, idx) => (
                  <div key={idx} className="mcp-env-row">
                    <input
                      type="text"
                      placeholder={t("mcpEnvKeyPlaceholder")}
                      value={item.key}
                      onChange={(e) => {
                        const updated = [...formEnv];
                        updated[idx].key = e.target.value;
                        setFormEnv(updated);
                      }}
                    />
                    <input
                      type="text"
                      placeholder={t("mcpEnvValuePlaceholder")}
                      value={item.value}
                      onChange={(e) => {
                        const updated = [...formEnv];
                        updated[idx].value = e.target.value;
                        setFormEnv(updated);
                      }}
                    />
                    <button
                      className="mcp-icon-btn mcp-icon-btn--danger"
                      onClick={() => setFormEnv(formEnv.filter((_, i) => i !== idx))}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="mcp-btn mcp-btn--sm"
                  onClick={() => setFormEnv([...formEnv, { key: "", value: "" }])}
                >
                  {t("mcpAddEnvVar")}
                </button>
              </div>

              <div className="mcp-form-group mcp-form-group--inline">
                <label>{t("mcpEnableOnStartup")}</label>
                <button
                  type="button"
                  className={`mcp-switch ${formEnabled ? "mcp-switch--active" : ""}`}
                  onClick={() => setFormEnabled(!formEnabled)}
                  aria-checked={formEnabled}
                  role="switch"
                >
                  <span className="mcp-switch__thumb" />
                </button>
              </div>

            </div>

            <div className="mcp-modal__footer">
              <button className="mcp-btn" onClick={() => setIsAdding(false)}>
                {t("cancel")}
              </button>
              <button className="mcp-btn mcp-btn--primary" onClick={handleSaveForm}>
                {t("mcpSaveServer")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
