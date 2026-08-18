use super::snapshot::snapshot_url;
use super::{BrowserEventSink, BrowserManager, BrowserToolResult};
use crate::policy::validate_navigation_url;
use serde_json::{json, Value};

impl BrowserManager {
    pub async fn navigate(
        &self,
        url: &str,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let url = validate_navigation_url(url)?;
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        emit(
            "browser:action-started",
            json!({"action":"navigate","url":url}),
        );
        emit("browser:loading", json!({"loading":true,"url":url}));
        let (_, page_session) = session.page();
        let page_session = page_session.to_string();
        session
            .cdp
            .command("Page.navigate", json!({"url": url}), Some(&page_session))
            .await?;
        drop(state);
        tokio::time::sleep(std::time::Duration::from_millis(550)).await;
        let snapshot = self.capture_state(emit, true).await?;
        emit(
            "browser:loading",
            json!({"loading":false,"url":snapshot_url(Some(&snapshot))}),
        );
        let result = BrowserToolResult {
            action: "navigate".to_string(),
            url: snapshot_url(Some(&snapshot)),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"snapshot": snapshot}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }

    pub async fn history(
        &self,
        direction: i32,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        let page_session = session.active_session.clone();
        let history = session
            .cdp
            .command("Page.getNavigationHistory", json!({}), Some(&page_session))
            .await?;
        let index = history["currentIndex"].as_i64().unwrap_or(0) + i64::from(direction);
        let entry = history["entries"]
            .as_array()
            .and_then(|entries| entries.get(index.max(0) as usize));
        let entry_id = entry
            .and_then(|entry| entry["id"].as_i64())
            .ok_or_else(|| "No history entry in that direction".to_string())?;
        let action = if direction < 0 { "back" } else { "forward" };
        emit("browser:action-started", json!({"action":action}));
        session
            .cdp
            .command(
                "Page.navigateToHistoryEntry",
                json!({"entryId":entry_id}),
                Some(&page_session),
            )
            .await?;
        drop(state);
        tokio::time::sleep(std::time::Duration::from_millis(450)).await;
        let snapshot = self.capture_state(emit, true).await?;
        let result = BrowserToolResult {
            action: action.into(),
            url: snapshot_url(Some(&snapshot)),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"snapshot":snapshot}),
        };
        emit(
            "browser:action-completed",
            serde_json::to_value(&result).unwrap_or(Value::Null),
        );
        Ok(result)
    }

    pub async fn reload(&self, emit: &BrowserEventSink<'_>) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        let page_session = session.active_session.clone();
        session
            .cdp
            .command("Page.reload", json!({}), Some(&page_session))
            .await?;
        drop(state);
        tokio::time::sleep(std::time::Duration::from_millis(450)).await;
        let snapshot = self.capture_state(emit, true).await?;
        Ok(BrowserToolResult {
            action: "reload".into(),
            url: snapshot_url(Some(&snapshot)),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"snapshot":snapshot}),
        })
    }
}
