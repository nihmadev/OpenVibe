use super::{BrowserEventPublisher, Session};
use serde_json::json;
use std::sync::{Arc, RwLock};
use std::time::Duration;

const UI_FRAME_INTERVAL: Duration = Duration::from_millis(33);

pub(super) async fn stop_screencast(session: &mut Session) {
    if let Some(stream) = session.ui_stream.take() {
        stream.abort();
        let _ = session
            .cdp
            .command(
                "Page.stopScreencast",
                json!({}),
                Some(&session.active_session),
            )
            .await;
    }
}

pub(super) async fn start_screencast(
    session: &mut Session,
    event_sink: Arc<RwLock<Option<BrowserEventPublisher>>>,
) -> Result<(), String> {
    stop_screencast(session).await;
    let page_session = session.active_session.clone();
    let cdp = session.cdp.clone();
    let mut events = cdp.subscribe();
    session
        .cdp
        .command(
            "Page.startScreencast",
            json!({"format":"jpeg","quality":68,"everyNthFrame":1}),
            Some(&page_session),
        )
        .await?;
    session.ui_stream = Some(tokio::spawn(async move {
        // Page.startScreencast produces another frame only after its previous
        // frame is acknowledged. Pace those acknowledgements at roughly
        // 30 fps so JPEG/base64 payloads cannot flood the desktop IPC queue.
        // Other CDP events remain responsive while a frame is waiting.
        let mut frame_clock = tokio::time::interval(UI_FRAME_INTERVAL);
        frame_clock.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        frame_clock.tick().await;
        let mut pending_frame_ack = None;
        loop {
            let event = tokio::select! {
                _ = frame_clock.tick(), if pending_frame_ack.is_some() => {
                    if let Some(frame_id) = pending_frame_ack.take() {
                        let _ = cdp.command_nowait(
                            "Page.screencastFrameAck",
                            json!({"sessionId":frame_id}),
                            Some(&page_session),
                        );
                    }
                    continue;
                }
                event = events.recv() => match event {
                    Ok(event) => event,
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            };
            if event["sessionId"].as_str() != Some(&page_session) {
                continue;
            }
            match event["method"].as_str() {
                Some("Page.frameStartedLoading") => {
                    if let Some(publish) = event_sink.read().ok().and_then(|sink| sink.clone()) {
                        publish("browser:loading", json!({"loading":true}));
                    }
                    continue;
                }
                Some("Page.frameStoppedLoading") => {
                    if let Some(publish) = event_sink.read().ok().and_then(|sink| sink.clone()) {
                        publish("browser:loading", json!({"loading":false}));
                    }
                    continue;
                }
                Some("Page.frameNavigated") => {
                    if event["params"]["frame"]["parentId"].is_null() {
                        if let Some(publish) = event_sink.read().ok().and_then(|sink| sink.clone())
                        {
                            publish(
                                "browser:page-changed",
                                json!({"url":event["params"]["frame"]["url"]}),
                            );
                        }
                    }
                    continue;
                }
                Some("Page.screencastFrame") => {}
                _ => continue,
            }
            let Some(frame_id) = event["params"]["sessionId"].as_u64() else {
                continue;
            };
            pending_frame_ack = Some(frame_id);
            let data = event["params"]["data"].as_str().unwrap_or_default();
            let metadata = &event["params"]["metadata"];
            let width = metadata["deviceWidth"].as_f64().unwrap_or(0.0).round() as u32;
            let height = metadata["deviceHeight"].as_f64().unwrap_or(0.0).round() as u32;
            let publisher = event_sink.read().ok().and_then(|sink| sink.clone());
            if let Some(publish) = publisher {
                let mut payload = json!({
                    "image":format!("data:image/jpeg;base64,{data}"),
                    "scroll":{"x":metadata["scrollOffsetX"],"y":metadata["scrollOffsetY"]}
                });
                if width > 0 && height > 0 {
                    payload["viewport"] =
                        json!({"width":width,"height":height,"deviceScaleFactor":1});
                }
                publish("browser:snapshot", payload);
            }
        }
    }));
    Ok(())
}
