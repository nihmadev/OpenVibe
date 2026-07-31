import { invoke } from "@tauri-apps/api/core";

let lastAttempt = 0;

/**
 * Fire-and-forget LLM connection pre-warm on user intent signals
 * (prompt focus, typing). Establishes the pooled TCP+TLS connection to the
 * chat origin in the Rust backend so the actual request skips DNS + TCP +
 * TLS handshake latency entirely.
 *
 * Throttled on both sides: here to avoid IPC spam on every keystroke, and in
 * the backend to avoid redundant network probes.
 */
export function prewarmLlmConnection(): void {
  const now = Date.now();
  if (now - lastAttempt < 10_000) return;
  lastAttempt = now;
  invoke("llm_prewarm").catch(() => {
    /* best-effort: never surface warm-up failures */
  });
}
