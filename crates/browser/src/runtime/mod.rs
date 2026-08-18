mod input;
mod launch;
mod lifecycle;
mod navigation;
mod screencast;
mod snapshot;
mod tabs;
mod ui;

use crate::cdp::CdpConnection;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use std::process::Child;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, RwLock};
use tokio::sync::Mutex;

pub type BrowserEventSink<'a> = dyn Fn(&str, Value) + Send + Sync + 'a;
pub type BrowserEventPublisher = Arc<dyn Fn(&str, Value) + Send + Sync + 'static>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserToolResult {
    pub action: String,
    pub url: Option<String>,
    pub target: Option<String>,
    pub duration_ms: u128,
    pub result: Value,
}

struct Session {
    id: String,
    child: Child,
    cdp: CdpConnection,
    active_target: String,
    active_session: String,
    manual_control: bool,
    last_snapshot: Option<Value>,
    ui_stream: Option<tokio::task::JoinHandle<()>>,
    viewport: (u32, u32),
    compatibility: BrowserCompatibility,
}

impl Session {
    fn page(&self) -> (&str, &str) {
        (&self.active_target, &self.active_session)
    }
}

#[derive(Clone)]
struct BrowserCompatibility {
    user_agent: String,
    accept_language: String,
    locale: String,
    platform: String,
}

pub struct BrowserManager {
    runtime_dir: PathBuf,
    profile_dir: PathBuf,
    screenshots_dir: PathBuf,
    state: Mutex<Option<Session>>,
    start_gate: Mutex<()>,
    ui_event_sink: Arc<RwLock<Option<BrowserEventPublisher>>>,
    skill_read: AtomicBool,
}
