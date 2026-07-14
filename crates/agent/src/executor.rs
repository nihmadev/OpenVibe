use crate::definition::ToolDefinition;
use std::sync::atomic::AtomicBool;

#[async_trait::async_trait]
pub trait ToolExecutor: Send + Sync {
    fn definitions(&self) -> Vec<ToolDefinition>;

    fn is_read_only(&self, _name: &str) -> bool {
        false
    }

    async fn execute(
        &self,
        name: &str,
        args: &serde_json::Value,
        cwd: &str,
        cancel: &AtomicBool,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) -> Result<String, String>;
}

