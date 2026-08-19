use crate::executor::AgentToolExecutor;

pub async fn execute(
    name: &str,
    args: &serde_json::Value,
    emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    executor: &AgentToolExecutor,
) -> Result<String, String> {
    let manager = executor
        .browser_manager()
        .ok_or_else(|| "Browser runtime is not available".to_string())?;
    if name != "browser_close" {
        manager.require_skill()?;
    }
    let result = match name {
        "browser_open" => {
            manager
                .open(args.get("url").and_then(serde_json::Value::as_str), emit)
                .await?
        }
        "browser_navigate" => manager.navigate(required_str(args, "url")?, emit).await?,
        "browser_snapshot" => manager.snapshot(emit).await?,
        "browser_click" => {
            manager
                .click(
                    required_str(args, "ref")?,
                    args.get("confirmed")
                        .and_then(serde_json::Value::as_bool)
                        .unwrap_or(false),
                    emit,
                )
                .await?
        }
        "browser_fill" => {
            manager
                .fill(
                    required_str(args, "ref")?,
                    required_str(args, "text")?,
                    false,
                    emit,
                )
                .await?
        }
        "browser_type" => {
            manager
                .fill(
                    required_str(args, "ref")?,
                    required_str(args, "text")?,
                    true,
                    emit,
                )
                .await?
        }
        "browser_press" => manager.press(required_str(args, "key")?, emit).await?,
        "browser_hover" => manager.hover(required_str(args, "ref")?, emit).await?,
        "browser_scroll" => {
            manager
                .scroll(
                    args.get("deltaX")
                        .and_then(serde_json::Value::as_f64)
                        .unwrap_or(0.0),
                    args.get("deltaY")
                        .and_then(serde_json::Value::as_f64)
                        .unwrap_or(600.0),
                    emit,
                )
                .await?
        }
        "browser_back" => manager.history(-1, emit).await?,
        "browser_forward" => manager.history(1, emit).await?,
        "browser_tabs" => {
            manager
                .tabs(
                    args.get("action")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("list"),
                    args.get("targetId").and_then(serde_json::Value::as_str),
                    args.get("url").and_then(serde_json::Value::as_str),
                    emit,
                )
                .await?
        }
        "browser_screenshot" => manager.screenshot(emit).await?,
        "browser_wait" => {
            manager
                .wait(
                    args.get("milliseconds")
                        .and_then(serde_json::Value::as_u64)
                        .unwrap_or(1000),
                    emit,
                )
                .await?
        }
        "browser_close" => manager.close(emit).await?,
        _ => return Err(format!("Unknown browser tool: {name}")),
    };
    serde_json::to_string(&result)
        .map_err(|error| format!("Cannot serialize browser result: {error}"))
}

fn required_str<'a>(args: &'a serde_json::Value, key: &str) -> Result<&'a str, String> {
    args.get(key)
        .and_then(serde_json::Value::as_str)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| format!("browser tool requires '{key}'"))
}
