use mcp::McpManager;
use tokio;
use std::path::PathBuf;

#[tokio::main]
async fn main() {
    let config_path = PathBuf::from("/home/nihmadev/OpenVibe/openvibe.toml");
    let manager = McpManager::new(&config_path);
    
    println!("Loading config...");
    let config = manager.get_config().unwrap();
    println!("Config servers: {:?}", config.servers);
    
    println!("Init and autostart...");
    manager.init_and_autostart().await;
    
    println!("Getting servers...");
    let servers = manager.get_servers().await;
    println!("Servers in memory: {:?}", servers);
}
