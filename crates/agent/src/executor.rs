use crate::definition::ToolDefinition;
use std::sync::atomic::AtomicBool;

#[async_trait::async_trait]
pub trait ToolExecutor: Send + Sync {
    fn definitions(&self) -> Vec<ToolDefinition>;

    fn requires_confirmation(&self, name: &str) -> bool;

    async fn execute(
        &self,
        name: &str,
        args: &serde_json::Value,
        cwd: &str,
        cancel: &AtomicBool,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) -> Result<String, String>;
}
