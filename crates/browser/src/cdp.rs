use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::{broadcast, mpsc, oneshot};
use tokio_tungstenite::{connect_async, tungstenite::Message};

type PendingCommands = Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>;

#[derive(Clone)]
pub struct CdpConnection {
    outbound: mpsc::UnboundedSender<Message>,
    pending: PendingCommands,
    events: broadcast::Sender<Value>,
    next_id: Arc<AtomicU64>,
}

impl CdpConnection {
    pub async fn connect(url: &str) -> Result<Self, String> {
        let (socket, _) = connect_async(url)
            .await
            .map_err(|error| format!("Cannot connect to Chromium CDP: {error}"))?;
        let (mut writer, mut reader) = socket.split();
        let (outbound, mut outbound_rx) = mpsc::unbounded_channel::<Message>();
        let (events, _) = broadcast::channel(64);
        let pending: PendingCommands = Arc::new(Mutex::new(HashMap::new()));

        tokio::spawn(async move {
            while let Some(message) = outbound_rx.recv().await {
                if writer.send(message).await.is_err() {
                    break;
                }
            }
            let _ = writer.close().await;
        });

        let reader_pending = pending.clone();
        let reader_events = events.clone();
        tokio::spawn(async move {
            while let Some(message) = reader.next().await {
                let Ok(Message::Text(text)) = message else {
                    continue;
                };
                let Ok(value) = serde_json::from_str::<Value>(&text) else {
                    continue;
                };
                if let Some(id) = value.get("id").and_then(Value::as_u64) {
                    if let Some(response) = reader_pending
                        .lock()
                        .ok()
                        .and_then(|mut pending| pending.remove(&id))
                    {
                        let result = if let Some(error) = value.get("error") {
                            Err(format!("CDP command failed: {error}"))
                        } else {
                            Ok(value.get("result").cloned().unwrap_or(Value::Null))
                        };
                        let _ = response.send(result);
                    }
                } else {
                    let _ = reader_events.send(value);
                }
            }
            if let Ok(mut pending) = reader_pending.lock() {
                for (_, response) in pending.drain() {
                    let _ = response.send(Err("Chromium CDP connection closed".to_string()));
                }
            }
        });

        Ok(Self {
            outbound,
            pending,
            events,
            next_id: Arc::new(AtomicU64::new(1)),
        })
    }

    pub fn subscribe(&self) -> broadcast::Receiver<Value> {
        self.events.subscribe()
    }

    pub async fn command(
        &self,
        method: &str,
        params: Value,
        session_id: Option<&str>,
    ) -> Result<Value, String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let mut payload = json!({"id": id, "method": method, "params": params});
        if let Some(session_id) = session_id {
            payload["sessionId"] = Value::String(session_id.to_string());
        }
        let (response_tx, response_rx) = oneshot::channel();
        self.pending
            .lock()
            .map_err(|_| "CDP command registry was poisoned".to_string())?
            .insert(id, response_tx);
        if self
            .outbound
            .send(Message::Text(payload.to_string()))
            .is_err()
        {
            if let Ok(mut pending) = self.pending.lock() {
                pending.remove(&id);
            }
            return Err(format!(
                "Cannot send CDP command {method}: connection closed"
            ));
        }
        tokio::time::timeout(std::time::Duration::from_secs(30), response_rx)
            .await
            .map_err(|_| format!("CDP command {method} timed out"))?
            .map_err(|_| format!("CDP command {method} was cancelled"))?
    }

    /// Sends a CDP command whose acknowledgement is intentionally ignored.
    /// This is used for high-frequency flow-control messages where waiting
    /// for the empty response would unnecessarily serialize the next frame.
    pub fn command_nowait(
        &self,
        method: &str,
        params: Value,
        session_id: Option<&str>,
    ) -> Result<(), String> {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let mut payload = json!({"id": id, "method": method, "params": params});
        if let Some(session_id) = session_id {
            payload["sessionId"] = Value::String(session_id.to_string());
        }
        self.outbound
            .send(Message::Text(payload.to_string()))
            .map_err(|_| format!("Cannot send CDP command {method}: connection closed"))
    }
}
