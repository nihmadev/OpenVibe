use super::screencast::{start_screencast, stop_screencast};
use super::snapshot::snapshot_url;
use super::{BrowserEventSink, BrowserManager, BrowserToolResult};
use crate::policy::validate_navigation_url;
use serde_json::json;

impl BrowserManager {
    pub async fn open(
        &self,
        url: Option<&str>,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        self.ensure_session(emit).await?;
        {
            let state = self.state.lock().await;
            let session = state
                .as_ref()
                .ok_or_else(|| "Browser session did not start".to_string())?;
            // A prewarmed session was launched with a silent event sink. Emit
            // before navigation so the workbench reveals the tab immediately.
            emit(
                "browser:session-started",
                json!({"sessionId":session.id,"profile":self.profile_dir}),
            );
        }
        if let Some(url) = url {
            self.navigate(url, emit).await?;
        } else {
            self.capture_state(emit, true).await?;
        }
        let state = self.state.lock().await;
        let session = state
            .as_ref()
            .ok_or_else(|| "Browser session did not start".to_string())?;
        Ok(BrowserToolResult {
            action: "open".to_string(),
            url: snapshot_url(session.last_snapshot.as_ref()),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"sessionId": session.id, "snapshot": session.last_snapshot}),
        })
    }

    /// Attach the visible pane to the warmed session. Unlike the agent-facing
    /// `open`, this avoids a synchronous DOM walk and screenshot; the CDP
    /// screencast supplies the first visible frame asynchronously.
    pub async fn open_ui(&self, emit: &BrowserEventSink<'_>) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        self.ensure_session(emit).await?;
        let state = self.state.lock().await;
        let session = state
            .as_ref()
            .ok_or_else(|| "Browser session did not start".to_string())?;
        emit(
            "browser:session-started",
            json!({"sessionId":session.id,"profile":self.profile_dir}),
        );
        Ok(BrowserToolResult {
            action: "open".to_string(),
            url: snapshot_url(session.last_snapshot.as_ref()),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"sessionId":session.id}),
        })
    }

    pub async fn start_ui_stream(&self) -> Result<(), String> {
        self.set_ui_stream_active(true).await
    }

    pub async fn set_ui_stream_active(&self, active: bool) -> Result<(), String> {
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        if active {
            if session.ui_stream.is_none() {
                start_screencast(session, self.ui_event_sink.clone()).await?;
            }
        } else {
            stop_screencast(session).await;
        }
        Ok(())
    }

    pub async fn resize_ui(&self, width: u32, height: u32) -> Result<(), String> {
        let width = width.clamp(240, 3840);
        let height = height.clamp(160, 2160);
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        if session.viewport == (width, height) {
            return Ok(());
        }
        let page_session = session.active_session.clone();
        session
            .cdp
            .command(
                "Emulation.setDeviceMetricsOverride",
                json!({
                    "width":width,
                    "height":height,
                    "deviceScaleFactor":1,
                    "mobile":false,
                    "screenWidth":width,
                    "screenHeight":height
                }),
                Some(&page_session),
            )
            .await?;
        session.viewport = (width, height);
        if session.ui_stream.is_some() {
            start_screencast(session, self.ui_event_sink.clone()).await?;
        }
        Ok(())
    }

    /// Navigation initiated by the address bar is a user action, so it is not
    /// subject to the agent skill/manual-control gate.
    pub async fn navigate_ui(
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
        let page_session = session.active_session.clone();
        emit("browser:loading", json!({"loading":true,"url":url}));
        session
            .cdp
            .command("Page.navigate", json!({"url":url}), Some(&page_session))
            .await?;
        Ok(BrowserToolResult {
            action: "navigate".into(),
            url: Some(url),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"navigationStarted":true}),
        })
    }

    pub async fn history_ui(
        &self,
        direction: i32,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        let page_session = session.active_session.clone();
        let history = session
            .cdp
            .command("Page.getNavigationHistory", json!({}), Some(&page_session))
            .await?;
        let index = history["currentIndex"].as_i64().unwrap_or(0) + i64::from(direction);
        let entry_id = history["entries"]
            .as_array()
            .and_then(|entries| entries.get(index.max(0) as usize))
            .and_then(|entry| entry["id"].as_i64())
            .ok_or_else(|| "No history entry in that direction".to_string())?;
        session
            .cdp
            .command(
                "Page.navigateToHistoryEntry",
                json!({"entryId":entry_id}),
                Some(&page_session),
            )
            .await?;
        emit("browser:loading", json!({"loading":true}));
        Ok(BrowserToolResult {
            action: if direction < 0 {
                "back".into()
            } else {
                "forward".into()
            },
            url: None,
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"navigationStarted":true}),
        })
    }

    pub async fn reload_ui(
        &self,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        let page_session = session.active_session.clone();
        emit("browser:loading", json!({"loading":true}));
        session
            .cdp
            .command("Page.reload", json!({}), Some(&page_session))
            .await?;
        Ok(BrowserToolResult {
            action: "reload".into(),
            url: snapshot_url(session.last_snapshot.as_ref()),
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"navigationStarted":true}),
        })
    }

    pub async fn set_manual_control(
        &self,
        manual: bool,
        emit: &BrowserEventSink<'_>,
    ) -> Result<(), String> {
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        session.manual_control = manual;
        if !manual {
            session.agent_input_blocked = false;
        }
        emit(
            "browser:manual-control",
            json!({"manual":manual,"sessionId":session.id}),
        );
        Ok(())
    }

    pub async fn manual_pointer(
        &self,
        kind: &str,
        x: f64,
        y: f64,
        delta_x: f64,
        delta_y: f64,
        _emit: &BrowserEventSink<'_>,
    ) -> Result<(), String> {
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        if !session.manual_control {
            return Err("Manual control is not active".to_string());
        }
        let page_session = session.active_session.clone();
        let (event_type, button) = match kind {
            "down" => ("mousePressed", "left"),
            "up" => ("mouseReleased", "left"),
            "wheel" => ("mouseWheel", "none"),
            _ => ("mouseMoved", "none"),
        };
        session.cdp.command("Input.dispatchMouseEvent", json!({"type":event_type,"x":x,"y":y,"button":button,"clickCount":if kind=="down"||kind=="up" {1} else {0},"deltaX":delta_x,"deltaY":delta_y}), Some(&page_session)).await?;
        Ok(())
    }

    pub async fn manual_key(
        &self,
        key: &str,
        text: Option<&str>,
        _emit: &BrowserEventSink<'_>,
    ) -> Result<(), String> {
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        if !session.manual_control {
            return Err("Manual control is not active".to_string());
        }
        let page_session = session.active_session.clone();
        if let Some(text) = text {
            session
                .cdp
                .command(
                    "Input.insertText",
                    json!({"text":text}),
                    Some(&page_session),
                )
                .await?;
        } else {
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
        }
        Ok(())
    }
}
