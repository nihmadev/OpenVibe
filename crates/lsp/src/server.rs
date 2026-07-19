use std::process::Stdio;
use tokio::process::{Child, Command};
use tracing::info;

use crate::LspServerConfig;

pub struct LspServer {
    config: LspServerConfig,
    process: Option<Child>,
}

impl LspServer {
    pub fn new(config: LspServerConfig) -> Self {
        Self {
            config,
            process: None,
        }
    }

    pub async fn start(&mut self) -> anyhow::Result<()> {
        info!("Starting LSP server: {}", self.config.name);

        let mut cmd = Command::new(&self.config.command);
        cmd.args(&self.config.args)
            .envs(&self.config.env)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let child = cmd.spawn()?;
        self.process = Some(child);

        info!("LSP server {} started successfully", self.config.name);
        Ok(())
    }

    pub async fn stop(&mut self) -> anyhow::Result<()> {
        if let Some(mut child) = self.process.take() {
            info!("Stopping LSP server: {}", self.config.name);
            child.kill().await?;
        }
        Ok(())
    }

    pub fn take_stdin(&mut self) -> Option<tokio::process::ChildStdin> {
        if let Some(child) = self.process.as_mut() {
            child.stdin.take()
        } else {
            None
        }
    }

    pub fn take_stdout(&mut self) -> Option<tokio::process::ChildStdout> {
        if let Some(child) = self.process.as_mut() {
            child.stdout.take()
        } else {
            None
        }
    }

    pub fn take_stderr(&mut self) -> Option<tokio::process::ChildStderr> {
        if let Some(child) = self.process.as_mut() {
            child.stderr.take()
        } else {
            None
        }
    }

    pub fn is_running(&self) -> bool {
        self.process.is_some()
    }
}
