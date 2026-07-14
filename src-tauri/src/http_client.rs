use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

/// Instantiates a shared high-performance `reqwest::Client` optimized for LLM API streaming.
///
/// Enables TCP keep-alive, low-latency TCP_NODELAY, connection pooling (up to 4 idle connections per host),
/// and HTTP/2 PING frames to preserve long-lived streaming connections across API proxies.
pub fn create_shared_client() -> reqwest::Client {
    reqwest::Client::builder()
        .pool_max_idle_per_host(4)
        .pool_idle_timeout(Duration::from_secs(120))
        .http2_keep_alive_interval(Some(Duration::from_secs(30)))
        .http2_keep_alive_timeout(Duration::from_secs(5))
        .tcp_keepalive(Some(Duration::from_secs(15)))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .tcp_nodelay(true)
        .build()
        .expect("Failed to initialize shared HTTP client instance")
}

/// Spawns a background connection pre-warming loop.
///
/// Periodically (every 60 seconds) dispatches a lightweight probe to the configured LLM API provider base endpoint
/// to maintain established TCP/TLS handshakes in the connection pool, eliminating TLS handshake latency on incoming user queries.
pub fn spawn_connection_warmer(
    client: reqwest::Client,
    provider_url: Arc<tokio::sync::Mutex<String>>,
    mut stop_rx: watch::Receiver<bool>,
) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        interval.tick().await;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let url = provider_url.lock().await;
                    if url.is_empty() {
                        continue;
                    }
                    let models_url = format!("{}/models", url.trim_end_matches('/'));
                    // Issue lightweight endpoint probe; establishing socket state even if 401/403 status is returned
                    let _ = client
                        .get(&models_url)
                        .timeout(Duration::from_secs(10))
                        .send()
                        .await;
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
