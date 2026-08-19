//! Cancellation primitives shared by LLM requests.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

/// Returns a future that completes when the given `AtomicBool` cancel flag
/// becomes `true`. Polls the flag every 50ms — fast enough for responsive UI
/// cancellation while adding negligible overhead.
pub async fn wait_for_cancel(cancel: &AtomicBool) {
    loop {
        if cancel.load(Ordering::Relaxed) {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

/// Sleep for `duration` but return early with `Err("Aborted")` if the cancel
/// flag is set. Replaces bare `tokio::time::sleep` in retry paths.
pub async fn cancellable_sleep(duration: Duration, cancel: &AtomicBool) -> Result<(), String> {
    tokio::select! {
        biased;
        _ = wait_for_cancel(cancel) => Err("Aborted".to_string()),
        _ = tokio::time::sleep(duration) => Ok(()),
    }
}
