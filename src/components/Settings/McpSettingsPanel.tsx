import React, { useState, useEffect } from "react";
import type { McpConfig, McpServerConfig, McpServerStatus } from "../../types.js";
import { mcpGetConfig, mcpSaveConfig, mcpGetServers, mcpStartServer, mcpStopServer } from "../../tauri-bridge.js";
import { Server, Plus, Edit2, Trash2, Download, Upload, AlertCircle } from "lucide-react";
import { TrashIcon, PlusIcon } from "../Icons/icons.js";
import { Toggle, Input } from "../ui/index.js";

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

  const getStatusDotClass = (name: string) => {
    const st = statuses.find((s) => s.name === name);
    if (!st || !st.enabled) return "mcp-dot--gray";
    const statusType = typeof st.status === "string" ? st.status : st.status.type;
    if (statusType === "running") return "mcp-dot--green";
    if (statusType === "starting") return "mcp-dot--starting";
    if (statusType === "stopped") return "mcp-dot--yellow";
    return "mcp-dot--red";
  };

  const currentServers = getServers(config);

  return (
    <>
      <div className="settings__subsection">
        <div className="settings__control-group">
          <div className="settings__control-row">
            <div className="settings__control-info">
              <div className="settings__control-label">{t("mcpRawConfig")}</div>
              <div className="settings__control-desc">{t("mcpVisualEditor")}</div>
            </div>
            <Toggle checked={isRawMode} onValueChange={setIsRawMode} />
          </div>
          <div className="settings__control-row">
            <div className="settings__control-info">
              <div className="settings__control-label">
                {t("mcpExport")} / {t("mcpImport")}
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="settings__edit-btn" onClick={handleExport}>
                <Download size={12} style={{ marginRight: 4 }} />
                {t("mcpExport")}
              </button>
              <label className="settings__edit-btn" style={{ cursor: "pointer", margin: 0 }}>
                <Upload size={12} style={{ marginRight: 4 }} />
                {t("mcpImport")}
                <input type="file" accept=".json" onChange={handleImport} hidden />
              </label>
            </div>
          </div>
        </div>
      </div>

      {isRawMode ? (
        <div className="settings__section" style={{ marginTop: 16 }}>
          <textarea
            className="settings__input"
            value={rawToml}
            onChange={(e) => setRawToml(e.target.value)}
            style={{
              width: "100%",
              fontFamily: "monospace",
              minHeight: 300,
              resize: "vertical",
              boxSizing: "border-box",
            }}
            placeholder={`[mcp]

[[mcp.server]]
name = "filesystem"
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"]
enabled = true`}
          />
          <button className="settings__connect-btn" style={{ marginTop: 12 }} onClick={handleSaveRawToml}>
            {t("mcpSaveTomlConfig")}
          </button>
        </div>
      ) : (
        <div className="settings__section" style={{ marginTop: 16 }}>
          <h3 className="settings__section-title">{t("mcpServers")}</h3>
          <div className="settings__providers-list">
            {currentServers.map((server) => (
              <div key={server.name} className="settings__provider-row">
                <div className="settings__provider-info">
                  <span className={`mcp-dot ${getStatusDotClass(server.name)}`} />
                  <Server size={14} style={{ opacity: 0.8 }} />
                  <div className="settings__provider-name">{server.name}</div>
                </div>
                <div className="settings__provider-actions">
                  <Toggle
                    checked={server.enabled}
                    onValueChange={(checked) => handleToggleServer(server.name, checked)}
                    title={server.enabled ? t("mcpDisableServer") : t("mcpEnableServer")}
                  />
                  <button className="settings__edit-btn" onClick={() => openEditModal(server)} title={t("edit")}>
                    <Edit2 size={12} />
                  </button>
                  <button
                    className="settings__disconnect-btn"
                    onClick={() => handleDeleteServer(server.name)}
                    title={t("delete")}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}

            <div className="settings__provider-row">
              <div className="settings__provider-info">
                <div className="settings__provider-icon-placeholder">
                  <Plus size={16} />
                </div>
                <div className="settings__provider-name">{t("mcpAddServer")}</div>
              </div>
              <button className="settings__connect-btn" onClick={openAddModal}>
                <Plus size={12} />
                {t("mcpAddServer")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Server Modal */}
      {isAdding && (
        <div className="connect-popup__overlay" onClick={() => setIsAdding(false)}>
          <div className="connect-popup" onClick={(e) => e.stopPropagation()}>
            <div className="connect-popup__header">
              <div className="connect-popup__icon-wrap">
                <div className="connect-popup__icon-placeholder">
                  <Server size={20} />
                </div>
              </div>
              <h2 className="connect-popup__title">
                {editingServer ? t("mcpEditServerTitle") : t("mcpAddServerTitle")}
              </h2>
              <button className="connect-popup__close" onClick={() => setIsAdding(false)}>
                ×
              </button>
            </div>

            <div className="connect-popup__body">
              {formError && (
                <div
                  style={{
                    color: "var(--error-fg, #e74c3c)",
                    fontSize: 12,
                    marginBottom: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={14} />
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

              <div className="connect-popup__section">
                <label className="connect-popup__label">{t("mcpCommandPath")}</label>
                <Input
                  containerClassName="connect-popup__input"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder={t("mcpCommandPlaceholder")}
                />
              </div>

              <div className="connect-popup__section">
                <label className="connect-popup__label">{t("mcpArguments")}</label>
                <Input
                  containerClassName="connect-popup__input"
                  value={formArgs}
                  onChange={(e) => setFormArgs(e.target.value)}
                  placeholder="-y @modelcontextprotocol/server-filesystem /tmp"
                />
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
                    <PlusIcon /> {t("mcpAddEnvVar")}
                  </button>
                </div>
              </div>

              <div className="connect-popup__section" style={{ marginTop: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Toggle checked={formEnabled} onValueChange={setFormEnabled} />
                  <label className="connect-popup__label">{t("mcpEnableOnStartup")}</label>
                </div>
              </div>
            </div>

            <div className="connect-popup__footer">
              <button className="connect-popup__btn connect-popup__btn--primary" onClick={handleSaveForm}>
                {t("mcpSaveServer")}
              </button>
              <button className="connect-popup__btn" onClick={() => setIsAdding(false)}>
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
