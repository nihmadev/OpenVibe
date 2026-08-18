use super::{BrowserEventPublisher, BrowserEventSink, BrowserManager, BrowserToolResult, Session};
use serde_json::json;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use tokio::sync::Mutex;

impl BrowserManager {
    pub fn new(app_data_dir: impl AsRef<Path>) -> Self {
        let root = app_data_dir.as_ref();
        Self {
            runtime_dir: root.join("runtimes"),
            profile_dir: root.join("browser-profile"),
            screenshots_dir: root.join("browser-screenshots"),
            state: Mutex::new(None),
            start_gate: Mutex::new(()),
            ui_event_sink: Arc::new(RwLock::new(None)),
            skill_read: AtomicBool::new(false),
        }
    }

    pub fn mark_skill_read(&self) {
        self.skill_read.store(true, Ordering::Release);
    }

    pub fn reset_agent_guard(&self) {
        self.skill_read.store(false, Ordering::Release);
    }

    pub fn require_skill(&self) -> Result<(), String> {
        if self.skill_read.load(Ordering::Acquire) {
            Ok(())
        } else {
            Err(
                "Before the first browser action, call read_skill with name 'browser-control'"
                    .to_string(),
            )
        }
    }

    pub async fn is_running(&self) -> bool {
        self.state.lock().await.is_some()
    }

    pub(super) async fn ensure_session(&self, emit: &BrowserEventSink<'_>) -> Result<(), String> {
        if self.state.lock().await.is_none() {
            let _gate = self.start_gate.lock().await;
            if self.state.lock().await.is_none() {
                let session = self.start_session(emit).await?;
                *self.state.lock().await = Some(session);
            }
        }
        Ok(())
    }

    /// Warm Chromium and CDP in the background without exposing a page or
    /// requiring the browser capability to be active yet.
    pub async fn prewarm(&self) -> Result<(), String> {
        self.ensure_session(&|_, _| {}).await
    }

    pub fn set_ui_event_sink(&self, sink: BrowserEventPublisher) {
        if let Ok(mut current) = self.ui_event_sink.write() {
            *current = Some(sink);
        }
    }

    pub(super) fn ensure_agent_action(&self, session: &Session) -> Result<(), String> {
        if !self.skill_read.load(Ordering::Acquire) {
            return Err(
                "Before the first browser action, call read_skill with name 'browser-control'"
                    .to_string(),
            );
        }
        if session.manual_control {
            return Err("Browser is under manual user control. Wait for the user to return control explicitly".to_string());
        }
        Ok(())
    }

    pub async fn close(&self, emit: &BrowserEventSink<'_>) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let _gate = self.start_gate.lock().await;
        let mut state = self.state.lock().await;
        let Some(mut session) = state.take() else {
            return Ok(BrowserToolResult {
                action: "close".into(),
                url: None,
                target: None,
                duration_ms: 0,
                result: json!({"closed":false}),
            });
        };
        if let Some(stream) = session.ui_stream.take() {
            stream.abort();
        }
        let _ = session.cdp.command("Browser.close", json!({}), None).await;
        let _ = session.child.kill();
        let _ = session.child.wait();
        emit("browser:session-closed", json!({"sessionId":session.id}));
        if let Ok(mut sink) = self.ui_event_sink.write() {
            *sink = None;
        }
        Ok(BrowserToolResult {
            action: "close".into(),
            url: None,
            target: None,
            duration_ms: started.elapsed().as_millis(),
            result: json!({"closed":true}),
        })
    }
}
impl Drop for BrowserManager {
    fn drop(&mut self) {
        if let Ok(mut state) = self.state.try_lock() {
            if let Some(mut session) = state.take() {
                if let Some(stream) = session.ui_stream.take() {
                    stream.abort();
                }
                let _ = session.child.kill();
                let _ = session.child.wait();
            }
        }
    }
}
