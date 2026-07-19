pub mod downloader;
pub mod languages;
pub mod runtime;
pub mod server;

use crate::server::LspServer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::sync::broadcast;
use tokio::sync::Mutex;

struct ManagedServer {
    server: LspServer,
    stdin: Arc<Mutex<tokio::process::ChildStdin>>,
    messages: broadcast::Sender<serde_json::Value>,
}

fn resolve_binary(command: &str, search_paths: &[PathBuf]) -> String {
    let exes = if cfg!(target_os = "windows") {
        vec![
            command.to_string(),
            format!("{}.exe", command),
            format!("{}.cmd", command),
            format!("{}.bat", command),
        ]
    } else {
        vec![command.to_string()]
    };

    for path in search_paths {
        for exe in &exes {
            let candidate = path.join(exe);
            if candidate.exists() {
                return candidate.to_string_lossy().to_string();
            }
        }
    }

    command.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspServerConfig {
    pub id: String,
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: std::collections::HashMap<String, String>,
}

#[derive(Default)]
pub struct LspManager {
    servers: Arc<Mutex<HashMap<String, ManagedServer>>>,
    base_dir: std::path::PathBuf,
}

impl LspManager {
    pub fn new(base_dir: std::path::PathBuf) -> Self {
        Self {
            servers: Arc::new(Mutex::new(HashMap::new())),
            base_dir,
        }
    }

    pub async fn activate(&self, lang: &str) -> anyhow::Result<()> {
        if self.is_active(lang).await {
            return Ok(());
        }
        if let Some(mut config) = languages::get_language_config(lang) {
            let path_env = std::env::var("PATH").unwrap_or_default();

            let node_version = "v20.12.2";
            let arch = if cfg!(target_arch = "x86_64") {
                "x64"
            } else {
                "arm64"
            };
            let os_name = if cfg!(target_os = "windows") {
                "win"
            } else if cfg!(target_os = "macos") {
                "darwin"
            } else {
                "linux"
            };

            let node_dir = self
                .base_dir
                .join(format!("node-{}-{}-{}", node_version, os_name, arch));

            let mut bin_paths = vec![];

            // Existing paths
            bin_paths.push(self.base_dir.join("node_modules").join(".bin"));
            bin_paths.push(if cfg!(target_os = "windows") {
                node_dir.clone()
            } else {
                node_dir.join("bin")
            });
            bin_paths.push(self.base_dir.join("go").join("bin"));
            bin_paths.push(self.base_dir.join("lua-language-server").join("bin"));

            // Python venv path
            bin_paths.push(
                self.base_dir
                    .join("venv")
                    .join(if cfg!(target_os = "windows") {
                        "Scripts"
                    } else {
                        "bin"
                    }),
            );

            // Ruby gems path
            bin_paths.push(self.base_dir.join("gems").join("bin"));

            // Dotnet tools path
            bin_paths.push(self.base_dir.join("dotnet-tools"));

            // Rust-analyzer is directly in base_dir
            bin_paths.push(self.base_dir.clone());

            // Clangd path
            bin_paths.push(self.base_dir.join("clangd_17.0.3").join("bin"));

            // JDTLS path
            bin_paths.push(self.base_dir.join("jdtls").join("bin"));

            let separator = if cfg!(target_os = "windows") {
                ";"
            } else {
                ":"
            };
            let bin_paths_str = bin_paths
                .iter()
                .map(|p| p.display().to_string())
                .collect::<Vec<_>>()
                .join(separator);

            let new_path = format!("{}{}{}", bin_paths_str, separator, path_env);
            config.env.insert("PATH".to_string(), new_path);

            // Resolve absolute path for the command so Command::new doesn't fail
            config.command = resolve_binary(&config.command, &bin_paths);

            let mut server = LspServer::new(config);
            server.start().await?;
            let stdin = server
                .take_stdin()
                .ok_or_else(|| anyhow::anyhow!("LSP stdin is unavailable"))?;
            let stdout = server
                .take_stdout()
                .ok_or_else(|| anyhow::anyhow!("LSP stdout is unavailable"))?;
            let stderr = server.take_stderr();
            let (messages, _) = broadcast::channel(256);
            let message_tx = messages.clone();
            tokio::spawn(async move {
                if let Err(error) = read_messages(stdout, message_tx).await {
                    tracing::error!("LSP stdout reader stopped: {error}");
                }
            });
            if let Some(stderr) = stderr {
                tokio::spawn(async move {
                    let mut lines = BufReader::new(stderr).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        tracing::debug!("LSP stderr: {line}");
                    }
                });
            }
            let mut servers = self.servers.lock().await;
            servers.insert(
                languages::get_language_config(lang)
                    .map(|c| c.id)
                    .unwrap_or_else(|| lang.to_string()),
                ManagedServer {
                    server,
                    stdin: Arc::new(Mutex::new(stdin)),
                    messages,
                },
            );
            Ok(())
        } else {
            anyhow::bail!("Language {} not supported", lang)
        }
    }

    pub async fn is_active(&self, lang: &str) -> bool {
        let id = languages::get_language_config(lang)
            .map(|c| c.id)
            .unwrap_or_else(|| lang.to_string());
        self.servers
            .lock()
            .await
            .get(&id)
            .is_some_and(|server| server.server.is_running())
    }

    pub async fn active_servers(&self) -> Vec<String> {
        self.servers.lock().await.keys().cloned().collect()
    }

    pub async fn send(&self, lang: &str, message: &serde_json::Value) -> anyhow::Result<()> {
        let id = languages::get_language_config(lang)
            .map(|c| c.id)
            .unwrap_or_else(|| lang.to_string());
        let stdin = self
            .servers
            .lock()
            .await
            .get(&id)
            .map(|server| server.stdin.clone())
            .ok_or_else(|| anyhow::anyhow!("LSP server {id} is not running"))?;
        let body = serde_json::to_vec(message)?;
        let mut stdin = stdin.lock().await;
        stdin
            .write_all(format!("Content-Length: {}\r\n\r\n", body.len()).as_bytes())
            .await?;
        stdin.write_all(&body).await?;
        stdin.flush().await?;
        Ok(())
    }

    pub async fn subscribe(
        &self,
        lang: &str,
    ) -> anyhow::Result<broadcast::Receiver<serde_json::Value>> {
        let id = languages::get_language_config(lang)
            .map(|c| c.id)
            .unwrap_or_else(|| lang.to_string());
        self.servers
            .lock()
            .await
            .get(&id)
            .map(|server| server.messages.subscribe())
            .ok_or_else(|| anyhow::anyhow!("LSP server {id} is not running"))
    }
}

async fn read_messages(
    reader: impl AsyncRead + Unpin,
    messages: broadcast::Sender<serde_json::Value>,
) -> anyhow::Result<()> {
    let mut reader = BufReader::new(reader);
    loop {
        let mut content_length = None;
        loop {
            let mut header = String::new();
            if reader.read_line(&mut header).await? == 0 {
                return Ok(());
            }
            if header == "\r\n" || header == "\n" {
                break;
            }
            if let Some(value) = header.to_ascii_lowercase().strip_prefix("content-length:") {
                content_length = Some(value.trim().parse::<usize>()?);
            }
        }
        let length =
            content_length.ok_or_else(|| anyhow::anyhow!("Missing LSP Content-Length header"))?;
        let mut body = vec![0; length];
        reader.read_exact(&mut body).await?;
        let message = serde_json::from_slice(&body)?;
        let _ = messages.send(message);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn reads_content_length_framed_json_rpc_messages() {
        let (mut writer, reader) = tokio::io::duplex(1024);
        let (messages, mut receiver) = broadcast::channel(4);
        let reader_task = tokio::spawn(read_messages(reader, messages));
        let body = br#"{"jsonrpc":"2.0","id":1,"result":{"ok":true}}"#;
        writer
            .write_all(
                format!("Content-Length: {}\r\nX-Test: value\r\n\r\n", body.len()).as_bytes(),
            )
            .await
            .unwrap();
        writer.write_all(body).await.unwrap();

        let message = receiver.recv().await.unwrap();
        assert_eq!(message["id"], 1);
        assert_eq!(message["result"]["ok"], true);

        drop(writer);
        reader_task.await.unwrap().unwrap();
    }
}
