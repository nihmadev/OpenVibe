use super::{BrowserEventPublisher, Session};
use serde_json::json;
use std::sync::{Arc, RwLock};

pub(super) async fn start_screencast(
    session: &mut Session,
    event_sink: Arc<RwLock<Option<BrowserEventPublisher>>>,
) -> Result<(), String> {
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
        loop {
            let event = match events.recv().await {
                Ok(event) => event,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
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
            // Chromium waits for this acknowledgement before producing the
            // next screencast frame. Send it before base64/Tauri work and do
            // not wait for the empty CDP response, otherwise the stream is
            // effectively capped by two IPC round trips per frame.
            let _ = cdp.command_nowait(
                "Page.screencastFrameAck",
                json!({"sessionId":frame_id}),
                Some(&page_session),
            );
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
