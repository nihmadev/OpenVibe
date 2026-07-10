use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;

/// Создаёт общий reqwest::Client с оптимизациями для LLM провайдеров:
/// HTTP/2, keep-alive, tcp_nodelay, connection pooling, таймауты.
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
        .expect("Failed to create shared reqwest::Client")
}

/// Фоновая задача: каждые 60 сек делает лёгкий запрос к активному провайдеру,
/// чтобы TCP/TLS соединение оставалось в пуле «тёплым».
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
                    // Делаем GET /models — даже при 401/403 TCP/TLS соединение установлено
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
