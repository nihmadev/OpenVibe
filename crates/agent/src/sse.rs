mod accumulator;
mod anthropic;
mod frame;
mod openai;
mod reasoning;

use std::sync::atomic::{AtomicBool, Ordering};

use accumulator::{Accumulator, Callbacks};
use frame::{SseEvent, SseParser};

use crate::cancel::wait_for_cancel;
use crate::chat::AssistantTurn;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum StreamFormat {
    Unknown,
    OpenAi,
    Anthropic,
}

pub async fn parse_sse_stream(
    mut res: reqwest::Response,
    cancel: &AtomicBool,
    on_delta: &(dyn Fn(&str) + Send + Sync),
    on_reasoning: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_name: &(dyn Fn(&str) + Send + Sync),
    on_reasoning_end: &(dyn Fn() + Send + Sync),
    on_tool_args: &(dyn Fn(&str, &str) + Send + Sync),
) -> Result<AssistantTurn, String> {
    let callbacks = Callbacks {
        on_delta,
        on_reasoning,
        on_reasoning_name,
        on_reasoning_end,
        on_tool_args,
    };
    let mut accumulator = Accumulator::new(callbacks);
    let mut parser = SseParser::default();
    let mut format = StreamFormat::Unknown;
    let (chunk_tx, mut chunk_rx) = tokio::sync::mpsc::channel(32);
    let reader = tokio::spawn(async move {
        loop {
            match res.chunk().await {
                Ok(Some(bytes)) => {
                    if chunk_tx.send(Ok(bytes)).await.is_err() {
                        break;
                    }
                }
                Ok(None) => break,
                Err(error) => {
                    let _ = chunk_tx.send(Err(error.to_string())).await;
                    break;
                }
            }
        }
    });
    let _reader = AbortOnDrop(reader);

    loop {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        let chunk = tokio::select! {
            biased;
            _ = wait_for_cancel(cancel) => return Err("Aborted".to_string()),
            result = chunk_rx.recv() => result.transpose()?,
        };

        let Some(bytes) = chunk else {
            break;
        };
        for event in parser.push(&bytes)? {
            if dispatch_event(event, &mut format, &mut accumulator)? {
                return accumulator.finish();
            }
        }
    }

    for event in parser.finish()? {
        if dispatch_event(event, &mut format, &mut accumulator)? {
            break;
        }
    }
    accumulator.finish()
}

// Callbacks remain synchronous for API compatibility. Reading runs in its own
// task so callback work cannot stall the provider socket or create read-loop locks.
struct AbortOnDrop(tokio::task::JoinHandle<()>);

impl Drop for AbortOnDrop {
    fn drop(&mut self) {
        self.0.abort();
    }
}

fn dispatch_event(
    event: SseEvent,
    format: &mut StreamFormat,
    accumulator: &mut Accumulator<'_>,
) -> Result<bool, String> {
    let event_type = event.event.as_deref();
    let is_anthropic = event_type.is_some_and(anthropic::is_event_type);

    if is_anthropic {
        if *format == StreamFormat::OpenAi {
            return Err(
                "SSE stream changed from OpenAI-compatible to Anthropic format".to_string(),
            );
        }
        *format = StreamFormat::Anthropic;
        return anthropic::decode(&event, accumulator).map(|_| false);
    }

    if event.data == "[DONE]" {
        if *format == StreamFormat::Anthropic {
            return Err("Anthropic SSE event contains invalid [DONE] payload".to_string());
        }
        *format = StreamFormat::OpenAi;
        return Ok(true);
    }

    if event.data.is_empty() {
        return Ok(false);
    }
    if *format == StreamFormat::Anthropic {
        return anthropic::decode(&event, accumulator).map(|_| false);
    }

    *format = StreamFormat::OpenAi;
    openai::decode(&event, accumulator).map(|_| false)
}

#[cfg(test)]
mod tests;
