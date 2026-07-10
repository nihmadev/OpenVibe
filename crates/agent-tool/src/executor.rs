use std::sync::atomic::AtomicBool;
use std::sync::Mutex;

use agent::{config::LlmConfig, ToolDefinition, ToolExecutor};

use crate::definition;
use crate::execute::execute_tool;

pub struct AgentToolExecutor {
    llm_config: Mutex<Option<LlmConfig>>,
}

impl AgentToolExecutor {
    pub fn new() -> Self {
        Self {
            llm_config: Mutex::new(None),
        }
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
        definition::build_tool_definitions()
    }

    fn requires_confirmation(&self, name: &str) -> bool {
        definition::requires_confirmation(name)
    }

    async fn execute(
        &self,
        name: &str,
        args: &serde_json::Value,
        cwd: &str,
        cancel: &AtomicBool,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) -> Result<String, String> {
        execute_tool(name, args, cwd, cancel, emit, self).await
    }
}
