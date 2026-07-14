use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct McpServerConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
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

fn main() {
    let content = r#"
[[mcp.servers]]
name = "godot"
command = "npx"
args = [
    "-y",
    "@coding-solo/godot-mcp",
]
enabled = true

[mcp.servers.env]
"#;

    let res: Result<RootConfig, _> = toml::from_str(content);
    println!("Strict Parse: {:?}", res);
    if let Err(e) = res {
        println!("Error: {}", e);
    }
}
