use super::snapshot::{runtime_json, snapshot_url};
use super::{BrowserEventSink, BrowserManager, BrowserToolResult};
use serde_json::{json, Value};

impl BrowserManager {
    pub async fn click(
        &self,
        reference: &str,
        confirmed: bool,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let (point, target, page_session) = self.resolve_target(reference).await?;
        if is_irreversible_target(&target) && !confirmed {
            return Err(format!(
                "Clicking '{target}' may have an irreversible external effect. Ask the user for confirmation, then retry with confirmed=true"
            ));
        }
        emit(
            "browser:action-started",
            json!({"action":"click","target":target,"ref":reference}),
        );
        let duration = pointer_duration(point.0, point.1);
        emit(
            "browser:pointer-move",
            json!({"x":point.0,"y":point.1,"durationMs":duration,"target":target,"ref":reference}),
        );
        tokio::time::sleep(std::time::Duration::from_millis(duration)).await;
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        session
            .cdp
            .command(
                "Input.dispatchMouseEvent",
                json!({"type":"mouseMoved","x":point.0,"y":point.1}),
                Some(&page_session),
            )
            .await?;
        emit(
            "browser:pointer-down",
            json!({"x":point.0,"y":point.1,"button":"left"}),
        );
        session.cdp.command("Input.dispatchMouseEvent", json!({"type":"mousePressed","x":point.0,"y":point.1,"button":"left","clickCount":1}), Some(&page_session)).await?;
        tokio::time::sleep(std::time::Duration::from_millis(90)).await;
        emit(
            "browser:pointer-up",
            json!({"x":point.0,"y":point.1,"button":"left"}),
        );
        session.cdp.command("Input.dispatchMouseEvent", json!({"type":"mouseReleased","x":point.0,"y":point.1,"button":"left","clickCount":1}), Some(&page_session)).await?;
        drop(state);
        tokio::time::sleep(std::time::Duration::from_millis(350)).await;
        let snapshot = self.capture_state(emit, true).await?;
        let result = BrowserToolResult {
            action: "click".into(),
            url: snapshot_url(Some(&snapshot)),
            target: Some(target),
            duration_ms: started.elapsed().as_millis(),
            result: json!({"clicked":reference,"snapshot":snapshot}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }

    async fn resolve_target(
        &self,
        reference: &str,
    ) -> Result<((f64, f64), String, String), String> {
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        let page_session = session.active_session.clone();
        let expression = format!(
            "(() => {{ const el = window.__openvibeRefNodes && window.__openvibeRefNodes.get({}); if (!el) return null; el.scrollIntoView({{block:'center',inline:'center'}}); const r=el.getBoundingClientRect(); return {{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height,name:(el.getAttribute('aria-label')||el.innerText||el.getAttribute('placeholder')||el.tagName).trim().slice(0,120),password:el instanceof HTMLInputElement && el.type==='password'}}; }})()",
            serde_json::to_string(reference).unwrap_or_else(|_| "\"\"".to_string())
        );
        let value = runtime_json(&mut session.cdp, &page_session, &expression).await?;
        if value.is_null() {
            return Err(format!(
                "Element ref '{reference}' is stale; take a new snapshot"
            ));
        }
        if value["password"].as_bool() == Some(true) {
            return Err(
                "Password fields require manual control; agent input is blocked".to_string(),
            );
        }
        let x = value["x"]
            .as_f64()
            .ok_or_else(|| "Target has no bounding box".to_string())?;
        let y = value["y"]
            .as_f64()
            .ok_or_else(|| "Target has no bounding box".to_string())?;
        let target = value["name"].as_str().unwrap_or(reference).to_string();
        Ok(((x, y), target, page_session))
    }

    pub async fn fill(
        &self,
        reference: &str,
        text: &str,
        incremental: bool,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let (point, target, page_session) = self.resolve_target(reference).await?;
        emit(
            "browser:action-started",
            json!({"action":if incremental {"type"} else {"fill"},"target":target,"ref":reference}),
        );
        emit(
            "browser:pointer-move",
            json!({"x":point.0,"y":point.1,"durationMs":180,"target":target,"ref":reference}),
        );
        tokio::time::sleep(std::time::Duration::from_millis(180)).await;
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        session.cdp.command("Input.dispatchMouseEvent", json!({"type":"mousePressed","x":point.0,"y":point.1,"button":"left","clickCount":1}), Some(&page_session)).await?;
        session.cdp.command("Input.dispatchMouseEvent", json!({"type":"mouseReleased","x":point.0,"y":point.1,"button":"left","clickCount":1}), Some(&page_session)).await?;
        if !incremental {
            session
                .cdp
                .command(
                    "Input.dispatchKeyEvent",
                    json!({"type":"keyDown","key":"a","code":"KeyA","modifiers":2}),
                    Some(&page_session),
                )
                .await?;
            session
                .cdp
                .command(
                    "Input.dispatchKeyEvent",
                    json!({"type":"keyUp","key":"a","code":"KeyA","modifiers":2}),
                    Some(&page_session),
                )
                .await?;
        }
        session
            .cdp
            .command(
                "Input.insertText",
                json!({"text":text}),
                Some(&page_session),
            )
            .await?;
        drop(state);
        let snapshot = self.capture_state(emit, true).await?;
        let action = if incremental { "type" } else { "fill" };
        let result = BrowserToolResult {
            action: action.into(),
            url: snapshot_url(Some(&snapshot)),
            target: Some(target),
            duration_ms: started.elapsed().as_millis(),
            result: json!({"ref":reference,"characters":text.chars().count(),"snapshot":snapshot}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }

    pub async fn press(
        &self,
        key: &str,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        let page_session = session.active_session.clone();
        emit(
            "browser:action-started",
            json!({"action":"press","target":key}),
        );
        session
            .cdp
            .command(
                "Input.dispatchKeyEvent",
                json!({"type":"keyDown","key":key}),
                Some(&page_session),
            )
            .await?;
        session
            .cdp
            .command(
                "Input.dispatchKeyEvent",
                json!({"type":"keyUp","key":key}),
                Some(&page_session),
            )
            .await?;
        drop(state);
        tokio::time::sleep(std::time::Duration::from_millis(200)).await;
        let snapshot = self.capture_state(emit, true).await?;
        let result = BrowserToolResult {
            action: "press".into(),
            url: snapshot_url(Some(&snapshot)),
            target: Some(key.to_string()),
            duration_ms: started.elapsed().as_millis(),
            result: json!({"key":key,"snapshot":snapshot}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }

    pub async fn hover(
        &self,
        reference: &str,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let (point, target, page_session) = self.resolve_target(reference).await?;
        emit(
            "browser:action-started",
            json!({"action":"hover","target":target,"ref":reference}),
        );
        emit(
            "browser:pointer-move",
            json!({"x":point.0,"y":point.1,"durationMs":220,"target":target,"ref":reference}),
        );
        tokio::time::sleep(std::time::Duration::from_millis(220)).await;
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        session
            .cdp
            .command(
                "Input.dispatchMouseEvent",
                json!({"type":"mouseMoved","x":point.0,"y":point.1}),
                Some(&page_session),
            )
            .await?;
        drop(state);
        let snapshot = self.capture_state(emit, false).await?;
        let result = BrowserToolResult {
            action: "hover".into(),
            url: snapshot_url(Some(&snapshot)),
            target: Some(target),
            duration_ms: started.elapsed().as_millis(),
            result: json!({"ref":reference}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }

    pub async fn scroll(
        &self,
        dx: f64,
        dy: f64,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        let page_session = session.active_session.clone();
        emit(
            "browser:action-started",
            json!({"action":"scroll","target":format!("{dx},{dy}")}),
        );
        session
            .cdp
            .command(
                "Input.dispatchMouseEvent",
                json!({"type":"mouseWheel","x":640,"y":400,"deltaX":dx,"deltaY":dy}),
                Some(&page_session),
            )
            .await?;
        drop(state);
        tokio::time::sleep(std::time::Duration::from_millis(180)).await;
        let snapshot = self.capture_state(emit, true).await?;
        let result = BrowserToolResult {
            action: "scroll".into(),
            url: snapshot_url(Some(&snapshot)),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"deltaX":dx,"deltaY":dy,"snapshot":snapshot}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }
}
fn pointer_duration(x: f64, y: f64) -> u64 {
    ((x.hypot(y) * 0.35).round() as u64).clamp(180, 650)
}

fn is_irreversible_target(target: &str) -> bool {
    let normalized = target.to_lowercase();
    [
        "publish",
        "send",
        "purchase",
        "buy",
        "place order",
        "delete",
        "remove",
        "submit",
        "post",
        "pay",
        "опубликов",
        "отправ",
        "купить",
        "заказать",
        "удалить",
        "оплатить",
    ]
    .iter()
    .any(|word| normalized.contains(word))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pointer_duration_is_bounded() {
        assert_eq!(pointer_duration(0.0, 0.0), 180);
        assert_eq!(pointer_duration(10_000.0, 10_000.0), 650);
    }
}
