use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::config::{load_mcp_config, save_mcp_config, McpConfig};
use crate::process::McpServerProcess;
use crate::types::{McpServerStatus, McpStatus};

pub struct McpManager {
    config_path: PathBuf,
    servers: Arc<RwLock<HashMap<String, Arc<McpServerProcess>>>>,
}

impl McpManager {
    pub fn new<P: AsRef<Path>>(config_path: P) -> Self {
        Self {
            config_path: config_path.as_ref().to_path_buf(),
            servers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn init_and_autostart(&self) {
        self.stop_all().await;

        let cfg = load_mcp_config(&self.config_path).unwrap_or_default();
        let mut servers_guard = self.servers.write().await;
        servers_guard.clear();

        for server_cfg in cfg.servers {
            let proc = Arc::new(McpServerProcess::new(server_cfg.clone()));
            servers_guard.insert(server_cfg.name.clone(), proc.clone());

            if server_cfg.enabled {
                let proc_clone = proc.clone();
                tokio::spawn(async move {
                    let _ = proc_clone.start().await;
                });
            }
        }
    }

    pub async fn persist_current_config(&self) -> Result<(), String> {
        let servers_guard = self.servers.read().await;
        let mut server_configs = Vec::new();
        for proc in servers_guard.values() {
            let cfg = proc.config.read().await;
            server_configs.push(cfg.clone());
        }
        server_configs.sort_by(|a, b| a.name.cmp(&b.name));
        save_mcp_config(
            &self.config_path,
            &McpConfig {
                servers: server_configs,
            },
        )
    }

    pub async fn get_servers(&self) -> Vec<McpServerStatus> {
        let servers_guard = self.servers.read().await;
        let mut list = Vec::new();

        for (name, proc) in servers_guard.iter() {
            let status = proc.status.lock().await.clone();
            let enabled = proc.config.read().await.enabled;
            let error = match &status {
                McpStatus::Error(msg) => Some(msg.clone()),
                _ => None,
            };

            list.push(McpServerStatus {
                name: name.clone(),
                status,
                enabled,
                error,
            });
        }

        list.sort_by(|a, b| a.name.cmp(&b.name));
        list
    }

    pub async fn start_server(&self, name: &str) -> Result<(), String> {
        let proc = {
            let servers_guard = self.servers.read().await;
            servers_guard
                .get(name)
                .cloned()
                .ok_or_else(|| format!("Server '{name}' not found"))?
        };
        {
            let mut cfg = proc.config.write().await;
            cfg.enabled = true;
        }
        let _ = self.persist_current_config().await;
        proc.start().await
    }

    pub async fn stop_server(&self, name: &str) -> Result<(), String> {
        let proc = {
            let servers_guard = self.servers.read().await;
            servers_guard
                .get(name)
                .cloned()
                .ok_or_else(|| format!("Server '{name}' not found"))?
        };
        {
            let mut cfg = proc.config.write().await;
            cfg.enabled = false;
        }
        let _ = self.persist_current_config().await;
        proc.stop().await
    }

    pub async fn restart_server(&self, name: &str) -> Result<(), String> {
        self.stop_server(name).await?;
        self.start_server(name).await
    }

    pub async fn get_status(&self, name: &str) -> Result<McpStatus, String> {
        let servers_guard = self.servers.read().await;
        let proc = servers_guard
            .get(name)
            .ok_or_else(|| format!("Server '{name}' not found"))?;
        let status = proc.status.lock().await.clone();
        Ok(status)
    }

    pub fn get_config(&self) -> Result<McpConfig, String> {
        load_mcp_config(&self.config_path)
    }

    pub async fn save_config(&self, config: McpConfig) -> Result<(), String> {
        save_mcp_config(&self.config_path, &config)?;
        self.init_and_autostart().await;
        Ok(())
    }

    pub async fn list_tools(&self, name: &str) -> Result<Vec<String>, String> {
        let servers_guard = self.servers.read().await;
        let proc = servers_guard
            .get(name)
            .ok_or_else(|| format!("Server '{name}' not found"))?;
        let tool_vals = proc.list_tools().await?;
        let tool_names = tool_vals
            .into_iter()
            .filter_map(|v| v["name"].as_str().map(|s| s.to_string()))
            .collect();
        Ok(tool_names)
    }

    pub fn get_cached_tools(&self) -> Vec<(String, Value)> {
        let Ok(servers_guard) = self.servers.try_read() else {
            return Vec::new();
        };
        let mut all_tools = Vec::new();
        for (server_name, proc) in servers_guard.iter() {
            let tools = proc.get_cached_tools_sync();
            for tool in tools {
                all_tools.push((server_name.clone(), tool));
            }
        }
        all_tools
    }

    pub async fn list_all_tools(&self) -> Vec<(String, Value)> {
        let servers_guard = self.servers.read().await;
        let mut all_tools = Vec::new();

        for (server_name, proc) in servers_guard.iter() {
            let status = proc.status.lock().await.clone();
            let enabled = proc.config.read().await.enabled;
            if enabled && matches!(status, McpStatus::Running) {
                if let Ok(tools) = proc.list_tools().await {
                    for tool in tools {
                        all_tools.push((server_name.clone(), tool));
                    }
                }
            }
        }
        all_tools
    }

    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        args: &Value,
    ) -> Result<String, String> {
        let servers_guard = self.servers.read().await;
        let proc = servers_guard
            .get(server_name)
            .ok_or_else(|| format!("MCP Server '{server_name}' not found"))?;
        proc.call_tool(tool_name, args).await
    }

    pub async fn stop_all(&self) {
        let servers_guard = self.servers.read().await;
        for proc in servers_guard.values() {
            let _ = proc.stop().await;
        }
    }
}
