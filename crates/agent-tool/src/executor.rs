use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

use agent_api::{LlmConfig, ToolDefFunction, ToolDefinition, ToolExecutor};

use crate::definition;
use crate::execute::execute_tool;

pub struct AgentToolExecutor {
    llm_config: Mutex<Option<LlmConfig>>,
    mcp_manager: Option<Arc<mcp::McpManager>>,
    browser_manager: Option<Arc<browser::BrowserManager>>,
}

impl Default for AgentToolExecutor {
    fn default() -> Self {
        Self::new()
    }
}

impl AgentToolExecutor {
    pub fn new() -> Self {
        Self {
            llm_config: Mutex::new(None),
            mcp_manager: None,
            browser_manager: None,
        }
    }

    pub fn with_mcp(mcp_manager: Arc<mcp::McpManager>) -> Self {
        Self {
            llm_config: Mutex::new(None),
            mcp_manager: Some(mcp_manager),
            browser_manager: None,
        }
    }

    pub fn with_mcp_and_browser(
        mcp_manager: Arc<mcp::McpManager>,
        browser_manager: Arc<browser::BrowserManager>,
    ) -> Self {
        Self {
            llm_config: Mutex::new(None),
            mcp_manager: Some(mcp_manager),
            browser_manager: Some(browser_manager),
        }
    }

    pub fn browser_manager(&self) -> Option<&Arc<browser::BrowserManager>> {
        self.browser_manager.as_ref()
    }

    pub fn set_llm_config(&self, config: LlmConfig) {
        *self.llm_config.lock().unwrap() = Some(config);
    }

    pub fn get_llm_config(&self) -> Option<LlmConfig> {
        self.llm_config.lock().unwrap().clone()
    }
}

#[async_trait::async_trait]
impl ToolExecutor for AgentToolExecutor {
    fn definitions(&self) -> Vec<ToolDefinition> {
        let mut defs = definition::build_tool_definitions();

        if let Some(ref mcp) = self.mcp_manager {
            let mcp_tools = mcp.get_cached_tools();

            for (server_name, tool_val) in mcp_tools {
                let tool_name = tool_val["name"].as_str().unwrap_or("unknown");
                let description = tool_val["description"]
                    .as_str()
                    .unwrap_or("MCP Tool")
                    .to_string();
                let parameters = tool_val
                    .get("inputSchema")
                    .cloned()
                    .unwrap_or_else(|| serde_json::json!({ "type": "object", "properties": {} }));

                let full_name = format!("mcp__{server_name}__{tool_name}");
                defs.push(ToolDefinition {
                    type_: "function".to_string(),
                    function: ToolDefFunction {
                        name: full_name,
                        description: format!("[MCP Server: {server_name}] {description}"),
                        parameters,
                    },
                });
            }
        }

        defs
    }

    fn is_read_only(&self, name: &str) -> bool {
        if matches!(
            name,
            "read_file"
                | "list_dir"
                | "search_codebase"
                | "todo"
                | "web_search"
                | "fetch_url"
                | "list_skills"
                | "read_skill"
                | "read_skill_resource"
        ) {
            return true;
        }
        if name.starts_with("mcp__") {
            let parts: Vec<&str> = name.splitn(3, "__").collect();
            if parts.len() == 3 {
                let tool_name = parts[2].to_lowercase();
                if tool_name.starts_with("read_")
                    || tool_name.starts_with("get_")
                    || tool_name.starts_with("list_")
                    || tool_name.starts_with("search_")
                    || tool_name.starts_with("find_")
                    || tool_name.starts_with("fetch_")
                {
                    return true;
                }
            }
        }
        false
    }

    async fn execute(
        &self,
        name: &str,
        args: &serde_json::Value,
        cwd: &str,
        cancel: &AtomicBool,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) -> Result<String, String> {
        if name.starts_with("mcp__") {
            let parts: Vec<&str> = name.splitn(3, "__").collect();
            if parts.len() == 3 {
                let server_name = parts[1];
                let tool_name = parts[2];
                if let Some(ref mcp) = self.mcp_manager {
                    return mcp.call_tool(server_name, tool_name, args).await;
                } else {
                    return Err("MCP Manager not available".to_string());
                }
            }
        }
        if name.starts_with("browser_") {
            return crate::browser::execute(name, args, emit, self).await;
        }
        execute_tool(name, args, cwd, cancel, emit, self).await
    }
}
