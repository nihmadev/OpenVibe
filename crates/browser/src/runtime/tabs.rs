use super::screencast::start_screencast;
use super::{BrowserCompatibility, BrowserEventSink, BrowserManager, BrowserToolResult, Session};
use crate::cdp::CdpConnection;
use crate::policy::validate_navigation_url;
use serde_json::{json, Value};

impl BrowserManager {
    pub async fn tabs(
        &self,
        action: &str,
        target_id: Option<&str>,
        url: Option<&str>,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        self.ensure_agent_action(session)?;
        match action {
            "new" => {
                let url = validate_navigation_url(url.unwrap_or("about:blank"))?;
                create_tab(session, &url).await?;
            }
            "select" => {
                attach_target(
                    session,
                    target_id.ok_or_else(|| "targetId is required".to_string())?,
                )
                .await?
            }
            "close" => {
                let target = target_id.unwrap_or(&session.active_target).to_string();
                session
                    .cdp
                    .command("Target.closeTarget", json!({"targetId":target}), None)
                    .await?;
            }
            "list" => {}
            _ => return Err(format!("Unknown tabs action: {action}")),
        }
        if action != "list" && session.ui_stream.is_some() {
            start_screencast(session, self.ui_event_sink.clone()).await?;
        }
        let targets = session
            .cdp
            .command("Target.getTargets", json!({}), None)
            .await?;
        let tabs: Vec<Value> = targets["targetInfos"].as_array().into_iter().flatten().filter(|item| item["type"] == "page").map(|item| json!({"targetId":item["targetId"],"title":item["title"],"url":item["url"],"active":item["targetId"].as_str()==Some(&session.active_target)})).collect();
        let current_url = tabs
            .iter()
            .find(|tab| tab["active"] == true)
            .and_then(|tab| tab["url"].as_str())
            .map(str::to_string);
        emit(
            "browser:page-changed",
            json!({"tabs":tabs,"targetId":session.active_target,"url":current_url}),
        );
        Ok(BrowserToolResult {
            action: "tabs".into(),
            url: current_url,
            target: target_id.map(str::to_string),
            duration_ms: started.elapsed().as_millis(),
            result: json!({"tabs":tabs}),
        })
    }

    pub async fn tabs_ui(
        &self,
        action: &str,
        target_id: Option<&str>,
        url: Option<&str>,
        emit: &BrowserEventSink<'_>,
    ) -> Result<BrowserToolResult, String> {
        let started = std::time::Instant::now();
        let mut state = self.state.lock().await;
        let session = state
            .as_mut()
            .ok_or_else(|| "Browser is not open".to_string())?;
        match action {
            "new" => {
                let url = validate_navigation_url(url.unwrap_or("about:blank"))?;
                create_tab(session, &url).await?;
            }
            "select" => {
                attach_target(
                    session,
                    target_id.ok_or_else(|| "targetId is required".to_string())?,
                )
                .await?
            }
            "close" => {
                let target = target_id.unwrap_or(&session.active_target).to_string();
                session
                    .cdp
                    .command("Target.closeTarget", json!({"targetId":target}), None)
                    .await?;
                let targets = session
                    .cdp
                    .command("Target.getTargets", json!({}), None)
                    .await?;
                if let Some(next) = targets["targetInfos"]
                    .as_array()
                    .and_then(|items| {
                        items.iter().find(|item| {
                            item["type"] == "page" && item["targetId"].as_str() != Some(&target)
                        })
                    })
                    .and_then(|item| item["targetId"].as_str())
                {
                    attach_target(session, next).await?;
                }
            }
            "list" => {}
            _ => return Err(format!("Unknown tabs action: {action}")),
        }
        if action != "list" && session.ui_stream.is_some() {
            start_screencast(session, self.ui_event_sink.clone()).await?;
        }
        let targets = session
            .cdp
            .command("Target.getTargets", json!({}), None)
            .await?;
        let tabs: Vec<Value> = targets["targetInfos"].as_array().into_iter().flatten().filter(|item| item["type"] == "page").map(|item| json!({"targetId":item["targetId"],"title":item["title"],"url":item["url"],"active":item["targetId"].as_str()==Some(&session.active_target)})).collect();
        let current_url = tabs
            .iter()
            .find(|tab| tab["active"] == true)
            .and_then(|tab| tab["url"].as_str())
            .map(str::to_string);
        emit(
            "browser:page-changed",
            json!({"tabs":tabs,"targetId":session.active_target,"url":current_url}),
        );
        drop(state);
        if action != "list" {
            let _ = self.capture_state(emit, true).await;
        }
        Ok(BrowserToolResult {
            action: "tabs".into(),
            url: current_url,
            target: target_id.map(str::to_string),
            duration_ms: started.elapsed().as_millis(),
            result: json!({"tabs":tabs}),
        })
    }
}
async fn create_tab(session: &mut Session, url: &str) -> Result<(), String> {
    // Attach and apply the compatibility profile before the first remote
    // request. Creating a target directly at `url` leaks the headless UA on
    // that initial navigation and makes challenge providers behave
    // inconsistently between the first tab and later navigations.
    let created = session
        .cdp
        .command("Target.createTarget", json!({"url":"about:blank"}), None)
        .await?;
    let target = created["targetId"]
        .as_str()
        .ok_or_else(|| "New tab target missing".to_string())?
        .to_string();
    attach_target(session, &target).await?;
    if url != "about:blank" {
        let page_session = session.active_session.clone();
        session
            .cdp
            .command("Page.navigate", json!({"url":url}), Some(&page_session))
            .await?;
    }
    Ok(())
}

pub(super) async fn configure_page_compatibility(
    cdp: &CdpConnection,
    page_session: &str,
    compatibility: &BrowserCompatibility,
) -> Result<(), String> {
    cdp.command(
        "Network.setUserAgentOverride",
        json!({
            "userAgent":compatibility.user_agent,
            "acceptLanguage":compatibility.accept_language,
            "platform":compatibility.platform
        }),
        Some(page_session),
    )
    .await?;
    // Locale override is not available in a few older Chromium builds. The
    // HTTP language and --lang launch flag still provide a safe fallback.
    let _ = cdp
        .command(
            "Emulation.setLocaleOverride",
            json!({"locale":compatibility.locale}),
            Some(page_session),
        )
        .await;
    let _ = cdp
        .command(
            "Emulation.setFocusEmulationEnabled",
            json!({"enabled":true}),
            Some(page_session),
        )
        .await;
    let _ = cdp
        .command("Page.bringToFront", json!({}), Some(page_session))
        .await;
    Ok(())
}

async fn attach_target(session: &mut Session, target_id: &str) -> Result<(), String> {
    let attached = session
        .cdp
        .command(
            "Target.attachToTarget",
            json!({"targetId":target_id,"flatten":true}),
            None,
        )
        .await?;
    let page_session = attached["sessionId"]
        .as_str()
        .ok_or_else(|| "Tab session missing".to_string())?
        .to_string();
    session
        .cdp
        .command("Page.enable", json!({}), Some(&page_session))
        .await?;
    session
        .cdp
        .command("Runtime.enable", json!({}), Some(&page_session))
        .await?;
    configure_page_compatibility(&session.cdp, &page_session, &session.compatibility).await?;
    let (width, height) = session.viewport;
    session
        .cdp
        .command(
            "Emulation.setDeviceMetricsOverride",
            json!({"width":width,"height":height,"deviceScaleFactor":1,"mobile":false,"screenWidth":width,"screenHeight":height}),
            Some(&page_session),
        )
        .await?;
    session.active_target = target_id.to_string();
    session.active_session = page_session;
    Ok(())
}
