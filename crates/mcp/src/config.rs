use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use tracing::{info, warn};

fn default_true() -> bool {
    true
}

fn deserialize_args<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum ArgsHelper {
        Vec(Vec<String>),
        Str(String),
    }

    match Option::<ArgsHelper>::deserialize(deserializer)? {
        Some(ArgsHelper::Vec(v)) => Ok(v),
        Some(ArgsHelper::Str(s)) => Ok(s.split_whitespace().map(|item| item.to_string()).collect()),
        None => Ok(Vec::new()),
    }
}

fn deserialize_enabled<'de, D>(deserializer: D) -> Result<bool, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum EnabledHelper {
        Bool(bool),
        Str(String),
        Int(i64),
    }

    match Option::<EnabledHelper>::deserialize(deserializer)? {
        Some(EnabledHelper::Bool(b)) => Ok(b),
        Some(EnabledHelper::Str(s)) => {
            let lower = s.trim().to_lowercase();
            Ok(matches!(
                lower.as_str(),
                "true" | "yes" | "1" | "on" | "enabled"
            ))
        }
        Some(EnabledHelper::Int(i)) => Ok(i != 0),
        None => Ok(true),
    }
}

fn deserialize_env<'de, D>(deserializer: D) -> Result<HashMap<String, String>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum EnvHelper {
        Map(HashMap<String, String>),
        List(Vec<String>),
    }

    match Option::<EnvHelper>::deserialize(deserializer)? {
        Some(EnvHelper::Map(map)) => Ok(map),
        Some(EnvHelper::List(list)) => {
            let mut map = HashMap::new();
            for item in list {
                if let Some((k, v)) = item.split_once('=') {
                    map.insert(k.trim().to_string(), v.trim().to_string());
                }
            }
            Ok(map)
        }
        None => Ok(HashMap::new()),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    #[serde(default, deserialize_with = "deserialize_args")]
    pub args: Vec<String>,
    #[serde(default, deserialize_with = "deserialize_env")]
    pub env: HashMap<String, String>,
    #[serde(default = "default_true", deserialize_with = "deserialize_enabled")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct McpConfig {
    #[serde(default, alias = "server", alias = "servers")]
    pub servers: Vec<McpServerConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct RootConfig {
    #[serde(default)]
    pub mcp: McpConfig,
    #[serde(default, alias = "server")]
    pub servers: Option<Vec<McpServerConfig>>,
}

pub fn resolve_config_path<P: AsRef<Path>>(cwd_path: P) -> std::path::PathBuf {
    let project_config = cwd_path.as_ref().join("openvibe.toml");
    if project_config.exists() {
        return project_config;
    }
    if let Ok(home) = std::env::var("HOME") {
        let home_path = std::path::PathBuf::from(home);
        let global_dir = home_path.join(".config").join("openvibe");
        let global_config = global_dir.join("openvibe.toml");
        if global_config.exists() {
            return global_config;
        }
        let global_file = home_path.join(".config").join("openvibe.toml");
        if global_file.exists() {
            return global_file;
        }
    }

    project_config
}

pub fn load_mcp_config<P: AsRef<Path>>(path: P) -> Result<McpConfig, String> {
    let path = path.as_ref();
    if !path.exists() {
        let default_config = RootConfig::default();
        if let Ok(toml_str) = toml::to_string_pretty(&default_config) {
            let _ = fs::write(path, toml_str);
        }
        return Ok(McpConfig::default());
    }

    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read config: {e}"))?;

    // Try strict parse
    if let Ok(mut root) = toml::from_str::<RootConfig>(&content) {
        if root.mcp.servers.is_empty() {
            if let Some(top_servers) = root.servers.take() {
                root.mcp.servers = top_servers;
            }
        }
        // Save back if normalized format differs
        let normalized = save_mcp_config(path, &root.mcp);
        if let Err(e) = normalized {
            warn!("Failed to normalize config: {e}");
        }
        return Ok(root.mcp);
    }

    warn!(
        "TOML parsing failed for {}, attempting auto-recovery...",
        path.display()
    );

    // Auto-recovery attempt via dynamic value parsing
    let mut recovered_servers = Vec::new();
    if let Ok(val) = content.parse::<toml::Value>() {
        // Look for servers in mcp.server, mcp.servers, servers, server
        let candidates = vec![
            val.get("mcp").and_then(|m| m.get("server")),
            val.get("mcp").and_then(|m| m.get("servers")),
            val.get("servers"),
            val.get("server"),
        ];

        for cand in candidates {
            if let Some(array) = cand.and_then(|c| c.as_array()) {
                for item in array {
                    if let Ok(cfg) = item.clone().try_into::<McpServerConfig>() {
                        if !cfg.name.is_empty() && !cfg.command.is_empty() {
                            if !recovered_servers
                                .iter()
                                .any(|s: &McpServerConfig| s.name == cfg.name)
                            {
                                recovered_servers.push(cfg);
                            }
                        }
                    }
                }
            }
        }
    }

    // Backup invalid file
    let backup_path = path.with_extension("toml.bak");
    let _ = fs::write(&backup_path, &content);
    info!("Backed up invalid MCP config to {}", backup_path.display());

    let fixed_config = McpConfig {
        servers: recovered_servers,
    };

    let _ = save_mcp_config(path, &fixed_config);
    info!(
        "Auto-repaired and saved MCP config with {} servers",
        fixed_config.servers.len()
    );

    Ok(fixed_config)
}

pub fn save_mcp_config<P: AsRef<Path>>(path: P, config: &McpConfig) -> Result<(), String> {
    let root = RootConfig {
        mcp: config.clone(),
        servers: None,
    };
    let content =
        toml::to_string_pretty(&root).map_err(|e| format!("Failed to serialize config: {e}"))?;
    fs::write(path, content).map_err(|e| format!("Failed to write config file: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_toml_standard() {
        let toml_content = r#"
[mcp]

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
enabled = false
"#;
        let root: RootConfig = toml::from_str(toml_content).unwrap();
        assert_eq!(root.mcp.servers.len(), 2);
        assert_eq!(root.mcp.servers[0].name, "filesystem");
        assert_eq!(root.mcp.servers[0].command, "npx");
        assert!(root.mcp.servers[0].enabled);
        assert_eq!(root.mcp.servers[1].name, "github");
        assert!(!root.mcp.servers[1].enabled);
        assert_eq!(
            root.mcp.servers[1].env.get("GITHUB_TOKEN").unwrap(),
            "ghp_xxx"
        );
    }

    #[test]
    fn test_flexible_parsing() {
        let toml_content = r#"
[mcp]

[[mcp.server]]
name = "loose"
command = "node"
args = "index.js --port 8080"
enabled = "yes"
env = ["PORT=8080", "MODE=test"]
"#;
        let root: RootConfig = toml::from_str(toml_content).unwrap();
        assert_eq!(root.mcp.servers.len(), 1);
        let s = &root.mcp.servers[0];
        assert_eq!(s.args, vec!["index.js", "--port", "8080"]);
        assert!(s.enabled);
        assert_eq!(s.env.get("PORT").unwrap(), "8080");
        assert_eq!(s.env.get("MODE").unwrap(), "test");
    }

    #[test]
    fn test_auto_recovery() {
        let dir = std::env::temp_dir().join("openvibe_mcp_test");
        let _ = fs::create_dir_all(&dir);
        let config_path = dir.join("openvibe.toml");

        let bad_toml = r#"
[[servers]]
name = "recovered"
command = "uvx"
args = "mcp-server"
enabled = "1"
"#;
        let _ = fs::write(&config_path, bad_toml);

        let cfg = load_mcp_config(&config_path).unwrap();
        assert_eq!(cfg.servers.len(), 1);
        assert_eq!(cfg.servers[0].name, "recovered");
        assert_eq!(cfg.servers[0].command, "uvx");
        assert!(cfg.servers[0].enabled);

        let _ = fs::remove_dir_all(&dir);
    }
}
