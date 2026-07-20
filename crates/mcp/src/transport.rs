use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin};
use tokio::sync::Mutex;
use tracing::{info, warn};

use crate::config::McpServerConfig;
use crate::path::build_augmented_path;

/// Low-level transport layer for MCP stdio communication.
/// Handles process spawning, stdin/stdout management, and stderr logging.
pub struct McpTransport {
    child: Arc<Mutex<Option<Child>>>,
    stdin: Arc<Mutex<Option<ChildStdin>>>,
    stderr_logs: Arc<Mutex<Vec<String>>>,
}

impl McpTransport {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            stdin: Arc::new(Mutex::new(None)),
            stderr_logs: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Spawn the MCP server process and set up stdio pipes.
    pub async fn spawn(&self, config: &McpServerConfig) -> Result<(), String> {
        self.kill_child().await;
        self.stderr_logs.lock().await.clear();

        let mut cmd = tokio::process::Command::new(&config.command);
        cmd.args(&config.args);
        cmd.envs(&config.env);
        cmd.env("PATH", build_augmented_path());

        // Fast-path for npx: avoid network checks to speed up concurrent starts
        let is_npx = config.command == "npx"
            || config.command.ends_with("/npx")
            || config.command.ends_with("\\npx")
            || config.command.ends_with("npx.cmd")
            || config.command.ends_with("npx.exe");
        if is_npx {
            cmd.env("npm_config_update_notifier", "false");
            cmd.env("npm_config_fund", "false");
            cmd.env("npm_config_audit", "false");
            cmd.env("npm_config_prefer_offline", "true");
            cmd.env("npm_config_yes", "true");
        }

        cmd.stdin(Stdio::piped());
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn '{}': {e}", config.command))?;

        let stdin = child.stdin.take().ok_or("Failed to open stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open stdout")?;
        let stderr = child.stderr.take();

        // Spawn stderr reader
        let stderr_logs = self.stderr_logs.clone();
        let server_name = config.name.clone();
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

        *self.stdin.lock().await = Some(stdin);
        *self.child.lock().await = Some(child);

        // Spawn stdout reader (returns reader handle for caller)
        // NOTE: caller must consume stdout via a separate mechanism
        // For now, we store the child and let the protocol layer handle it
        Ok(())
    }

    /// Write a message to the server's stdin.
    pub async fn write_message(&self, msg: &str) -> Result<(), String> {
        let mut stdin_guard = self.stdin.lock().await;
        let stdin = stdin_guard.as_mut().ok_or("Server stdin not available")?;
        let mut line = msg.to_string();
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

    /// Get the last N stderr log lines for error reporting.
    pub async fn get_stderr_snippet(&self) -> String {
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

    /// Kill the child process and clean up resources.
    pub async fn kill_child(&self) {
        if let Some(mut child) = self.child.lock().await.take() {
            let _ = child.kill().await;
        }
        *self.stdin.lock().await = None;
    }

    /// Check if the process is still running.
    pub async fn is_process_alive(&self) -> bool {
        let mut guard = self.child.lock().await;
        if let Some(child) = guard.as_mut() {
            matches!(child.try_wait(), Ok(None))
        } else {
            false
        }
    }

    /// Take stdout for reading (returns tokio ChildStdout).
    pub async fn take_stdout(&self) -> Option<tokio::process::ChildStdout> {
        let mut guard = self.child.lock().await;
        guard.as_mut().and_then(|c| c.stdout.take())
    }
}

impl Default for McpTransport {
    fn default() -> Self {
        Self::new()
    }
}
