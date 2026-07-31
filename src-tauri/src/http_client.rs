use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

/// Instantiates a shared high-performance `reqwest::Client` optimized for LLM API streaming.
///
/// Enables TCP keep-alive, low-latency TCP_NODELAY, connection pooling,
/// and HTTP/2 PING frames to preserve long-lived streaming connections across API proxies.
///
/// Note: deliberately no total request `timeout()` — it would hard-kill long
/// SSE streams (reasoning models routinely stream for many minutes). Stall
/// protection comes from `read_timeout` (max gap between chunks) instead.
pub fn create_shared_client() -> reqwest::Client {
    reqwest::Client::builder()
        .pool_max_idle_per_host(4)
        // Keep idle sockets around long enough to survive a "think - read -
        // type next message" pause; the warmer re-establishes them anyway.
        .pool_idle_timeout(Duration::from_secs(300))
        .http2_keep_alive_interval(Some(Duration::from_secs(30)))
        .http2_keep_alive_timeout(Duration::from_secs(5))
        .http2_keep_alive_while_idle(true)
        .tcp_keepalive(Some(Duration::from_secs(15)))
        // Let hyper grow HTTP/2 flow-control windows based on observed BDP —
        // avoids stream stalls on high-latency routes with dense token output.
        .http2_adaptive_window(true)
        .connect_timeout(Duration::from_secs(10))
        // Max silence between stream chunks / response bytes, NOT total time.
        .read_timeout(Duration::from_secs(120))
        .tcp_nodelay(true)
        .build()
        .expect("Failed to initialize shared HTTP client instance")
}

/// Tracks connection warm-up state shared between the background warmer loop
/// and on-demand warm-up triggers (input focus, app start, provider switch).
pub struct ConnectionWarmer {
    client: reqwest::Client,
    /// Origin to warm (scheme://host) — the endpoint chat requests actually
    /// connect to (regional proxy when enabled, provider otherwise).
    origin: Arc<tokio::sync::Mutex<String>>,
    /// Unix millis of the last successful warm-up probe (0 = never).
    last_warm_ms: AtomicU64,
}

fn now_ms() -> u64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

impl ConnectionWarmer {
    pub fn new(client: reqwest::Client, initial_origin: String) -> Arc<Self> {
        Arc::new(Self {
            client,
            origin: Arc::new(tokio::sync::Mutex::new(initial_origin)),
            last_warm_ms: AtomicU64::new(0),
        })
    }

    /// Update the origin to warm (on provider/proxy change). Resets freshness
    /// so the next trigger warms the new host immediately.
    pub async fn set_origin(&self, origin: String) {
        let mut guard = self.origin.lock().await;
        if *guard != origin {
            *guard = origin;
            self.last_warm_ms.store(0, Ordering::Relaxed);
        }
    }

    /// Fire a lightweight probe to establish (or refresh) the pooled TCP+TLS
    /// connection. Throttled: skips if a probe succeeded within `min_age`.
    ///
    /// HEAD to the origin root is enough — any status (401/404) still leaves
    /// a warm connection in the pool for the subsequent POST.
    pub async fn warm(&self, min_age: Duration) {
        let last = self.last_warm_ms.load(Ordering::Relaxed);
        let now = now_ms();
        if last != 0 && now.saturating_sub(last) < min_age.as_millis() as u64 {
            return;
        }

        let origin = { self.origin.lock().await.clone() };
        if origin.is_empty() {
            return;
        }

        let result = self.client.head(&origin).timeout(Duration::from_secs(10)).send().await;

        if result.is_ok() {
            self.last_warm_ms.store(now_ms(), Ordering::Relaxed);
        }
    }
}

/// Spawns a background connection pre-warming loop.
///
/// Re-probes shortly before the pooled connection would go idle-dead, keeping
/// an established TCP/TLS session available so user prompts skip the
/// DNS + TCP + TLS handshake entirely.
pub fn spawn_connection_warmer(warmer: Arc<ConnectionWarmer>, mut stop_rx: watch::Receiver<bool>) {
    tauri::async_runtime::spawn(async move {
        // First warm-up right after startup (2s grace for app init), then
        // periodic refresh well within pool_idle_timeout / NAT timeouts.
        let mut interval = tokio::time::interval(Duration::from_secs(45));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        tokio::time::sleep(Duration::from_secs(2)).await;
        warmer.warm(Duration::from_secs(30)).await;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    warmer.warm(Duration::from_secs(30)).await;
                }
                _ = stop_rx.changed() => {
                    if *stop_rx.borrow() {
                        break;
                    }
                }
            }
        }
    });
}
