pub mod downloader;
pub mod languages;
pub mod runtime;
pub mod server;

use crate::server::LspServer;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

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
    servers: Arc<Mutex<HashMap<String, LspServer>>>,
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
            let mut servers = self.servers.lock().await;
            servers.insert(lang.to_string(), server);
            Ok(())
        } else {
            anyhow::bail!("Language {} not supported", lang)
        }
    }
}
