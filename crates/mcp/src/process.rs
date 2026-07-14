use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::{oneshot, Mutex, RwLock};
use tokio::time::{timeout, Duration};
use tracing::{info, warn};

use crate::config::McpServerConfig;
use crate::path::build_augmented_path;
use crate::types::McpStatus;

pub struct McpServerProcess {
    pub config: RwLock<McpServerConfig>,
    pub status: Arc<Mutex<McpStatus>>,
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    pending_requests: Arc<Mutex<HashMap<u64, oneshot::Sender<Value>>>>,
    stderr_logs: Arc<Mutex<Vec<String>>>,
    tools_cache: Arc<std::sync::Mutex<Vec<Value>>>,
    request_id: AtomicU64,
}

impl McpServerProcess {
    pub fn new(config: McpServerConfig) -> Self {
        Self {
            config: RwLock::new(config),
            status: Arc::new(Mutex::new(McpStatus::Stopped)),
            child: Arc::new(Mutex::new(None)),
            stdin: Arc::new(Mutex::new(None)),
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            stderr_logs: Arc::new(Mutex::new(Vec::new())),
            tools_cache: Arc::new(std::sync::Mutex::new(Vec::new())),
            request_id: AtomicU64::new(1),
        }
    }

    async fn get_stderr_snippet(&self) -> String {
        let logs = self.stderr_logs.lock().await;
        if logs.is_empty() {
            String::new()
        } else {
            let snippet = logs
                .iter()
                .rev()
                .take(3)
                .rev()
                .cloned()
                .collect::<Vec<_>>()
                .join("; ");
            format!("Stderr: {}", snippet)
        }
    }

    pub async fn start(&self) -> Result<(), String> {
        let mut status = self.status.lock().await;
        if matches!(*status, McpStatus::Running) {
            return Ok(());
        }

        let mut attempts = 0;
        let max_attempts = 3;
        let mut last_err = String::new();
        let server_name = self.config.read().await.name.clone();

        while attempts < max_attempts {
            attempts += 1;
            match self.spawn_and_init().await {
                Ok(_) => {
                    *status = McpStatus::Running;
                    info!(server = %server_name, "MCP server started successfully");
                    return Ok(());
                }
                Err(e) => {
                    last_err = e;
                    warn!(server = %server_name, attempt = attempts, err = %last_err, "Failed to start MCP server");
                    if attempts < max_attempts {
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        }

        *status = McpStatus::Error(last_err.clone());
        Err(last_err)
    }

    async fn spawn_and_init(&self) -> Result<(), String> {
        self.stderr_logs.lock().await.clear();
        let (cmd_path, args, env, server_name) = {
            let cfg = self.config.read().await;
            (
                cfg.command.clone(),
                cfg.args.clone(),
                cfg.env.clone(),
                cfg.name.clone(),
            )
        };

        let mut cmd = tokio::process::Command::new(&cmd_path);
        cmd.args(&args);
        cmd.envs(&env);
        cmd.env("PATH", build_augmented_path());
        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn process '{cmd_path}': {e}"))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take();

        let stderr_logs = self.stderr_logs.clone();
        if let Some(stderr) = stderr {
            tokio::spawn(async move {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    warn!(server = %server_name, "MCP stderr: {}", line);
                    let mut logs = stderr_logs.lock().await;
                    logs.push(line);
                    if logs.len() > 20 {
                        logs.remove(0);
                    }
                }
            });
        }

        let pending = self.pending_requests.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let line_str = line.trim();
                if line_str.is_empty() {
                    continue;
                }
                if let Ok(val) = serde_json::from_str::<Value>(line_str) {
                    if let Some(id_val) = val.get("id") {
                        if let Some(id) = id_val.as_u64() {
                            let mut guard = pending.lock().await;
                            if let Some(tx) = guard.remove(&id) {
                                let _ = tx.send(val);
                            }
                        }
                    }
                }
            }
        });

        *self.stdin.lock().await = Some(stdin);
        *self.child.lock().await = Some(child);

        let init_req_id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let init_msg = json!({
            "jsonrpc": "2.0",
            "id": init_req_id,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "OpenVibe",
                    "version": "1.2.0"
                }
            }
        });

        let resp = self
            .send_request_internal(init_req_id, &init_msg, Duration::from_secs(10))
            .await?;
        if resp.get("error").is_some() {
            let err_msg = resp["error"]["message"]
                .as_str()
                .unwrap_or("Initialize failed");
            let snippet = self.get_stderr_snippet().await;
            if !snippet.is_empty() {
                return Err(format!("{err_msg}. {snippet}"));
            } else {
                return Err(err_msg.to_string());
            }
        }

        let init_notif = json!({
            "jsonrpc": "2.0",
            "method": "notifications/initialized"
        });
        self.send_notification_internal(&init_notif).await?;

        if let Ok(tools) = self.list_tools().await {
            if let Ok(mut cache) = self.tools_cache.lock() {
                *cache = tools;
            }
        }

        Ok(())
    }

    pub fn get_cached_tools_sync(&self) -> Vec<Value> {
        self.tools_cache.lock().map(|cache| cache.clone()).unwrap_or_default()
    }

    async fn send_notification_internal(&self, msg: &Value) -> Result<(), String> {
        let mut stdin_guard = self.stdin.lock().await;
        let stdin = stdin_guard.as_mut().ok_or("Server stdin not available")?;
        let mut line = serde_json::to_string(msg).map_err(|e| e.to_string())?;
        line.push('\n');
        stdin
            .write_all(line.as_bytes())
            .await
            .map_err(|e| format!("Failed to write stdin: {e}"))?;
        stdin
            .flush()
            .await
            .map_err(|e| format!("Failed to flush stdin: {e}"))?;
        Ok(())
    }

    async fn send_request_internal(
        &self,
        req_id: u64,
        msg: &Value,
        timeout_dur: Duration,
    ) -> Result<Value, String> {
        let (tx, rx) = oneshot::channel();
        {
            let mut guard = self.pending_requests.lock().await;
            guard.insert(req_id, tx);
        }

        if let Err(e) = self.send_notification_internal(msg).await {
            let mut guard = self.pending_requests.lock().await;
            guard.remove(&req_id);
            return Err(e);
        }

        match timeout(timeout_dur, rx).await {
            Ok(Ok(val)) => Ok(val),
            Ok(Err(_)) => {
                let mut guard = self.pending_requests.lock().await;
                guard.remove(&req_id);
                let snippet = self.get_stderr_snippet().await;
                if !snippet.is_empty() {
                    Err(format!("Response channel closed. {snippet}"))
                } else {
                    Err("Response channel closed before receiving data".to_string())
                }
            }
            Err(_) => {
                let mut guard = self.pending_requests.lock().await;
                guard.remove(&req_id);
                let snippet = self.get_stderr_snippet().await;
                if !snippet.is_empty() {
                    Err(format!("Request timed out. {snippet}"))
                } else {
                    Err("Request timed out".to_string())
                }
            }
        }
    }

    pub async fn stop(&self) -> Result<(), String> {
        let mut status = self.status.lock().await;
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await;
        }
        *self.stdin.lock().await = None;
        self.pending_requests.lock().await.clear();
        if let Ok(mut cache) = self.tools_cache.lock() {
            cache.clear();
        }
        *status = McpStatus::Stopped;
        Ok(())
    }

    pub async fn list_tools(&self) -> Result<Vec<Value>, String> {
        let status = self.status.lock().await.clone();
        if !matches!(status, McpStatus::Running) {
            return Err("Server is not running".to_string());
        }

        let req_id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let msg = json!({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/list",
            "params": {}
        });

        let resp = self
            .send_request_internal(req_id, &msg, Duration::from_secs(5))
            .await?;
        if let Some(error) = resp.get("error") {
            let msg = error["message"].as_str().unwrap_or("Failed to list tools");
            return Err(msg.to_string());
        }

        let tools = resp["result"]["tools"]
            .as_array()
            .cloned()
            .unwrap_or_default();
        if let Ok(mut cache) = self.tools_cache.lock() {
            *cache = tools.clone();
        }
        Ok(tools)
    }

    pub async fn call_tool(&self, tool_name: &str, args: &Value) -> Result<String, String> {
        let status = self.status.lock().await.clone();
        if !matches!(status, McpStatus::Running) {
            return Err("Server is not running".to_string());
        }

        let req_id = self.request_id.fetch_add(1, Ordering::SeqCst);
        let msg = json!({
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args
            }
        });

        let resp = self
            .send_request_internal(req_id, &msg, Duration::from_secs(60))
            .await?;

        if let Some(error) = resp.get("error") {
            let msg = error["message"].as_str().unwrap_or("Failed to call tool");
            return Err(msg.to_string());
        }

        let result = &resp["result"];
        if let Some(content_arr) = result.get("content").and_then(|c| c.as_array()) {
            let mut out = String::new();
            for item in content_arr {
                if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                    if !out.is_empty() {
                        out.push('\n');
                    }
                    out.push_str(text);
                } else {
                    out.push_str(&item.to_string());
                }
            }
            if out.is_empty() {
                Ok(serde_json::to_string_pretty(result).unwrap_or_default())
            } else {
                Ok(out)
            }
        } else {
            Ok(serde_json::to_string_pretty(result).unwrap_or_default())
        }
    }
}
