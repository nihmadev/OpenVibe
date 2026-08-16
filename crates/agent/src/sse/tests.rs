use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use super::accumulator::{Accumulator, Callbacks};
use super::frame::SseParser;
use super::{dispatch_event, StreamFormat};
use crate::chat::AssistantTurn;

fn decode_chunks(chunks: &[&[u8]]) -> Result<AssistantTurn, String> {
    let mut parser = SseParser::default();
    let mut format = StreamFormat::Unknown;
    let callbacks = Callbacks {
        on_delta: &|_| {},
        on_reasoning: &|_| {},
        on_reasoning_name: &|_| {},
        on_reasoning_end: &|| {},
        on_tool_args: &|_, _| {},
    };
    let mut accumulator = Accumulator::new(callbacks);
    for chunk in chunks {
        for event in parser.push(chunk)? {
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

fn one_byte_chunks(input: &[u8]) -> Vec<&[u8]> {
    input.chunks(1).collect()
}

#[test]
fn frames_multiline_data_and_metadata_across_mixed_newlines() {
    let input = b": keepalive\r\nevent: custom\nid: 42\r\nretry: 1500\ndata: first\r\ndata:\ndata: third\r\n\n";
    let mut parser = SseParser::default();
    let mut events = Vec::new();
    for chunk in input.chunks(1) {
        events.extend(parser.push(chunk).unwrap());
    }
    events.extend(parser.finish().unwrap());
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].event.as_deref(), Some("custom"));
    assert_eq!(events[0].id.as_deref(), Some("42"));
    assert_eq!(events[0].retry, Some(1500));
    assert_eq!(events[0].data, "first\n\nthird");
}

#[test]
fn emits_last_event_without_blank_line() {
    let turn = decode_chunks(&[b"data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}"]).unwrap();
    assert_eq!(turn.content, "ok");
}

#[test]
fn decodes_json_joined_from_multiple_data_fields() {
    let turn =
        decode_chunks(&[b"data: {\"choices\":[\ndata: {\"delta\":{\"content\":\"joined\"}}]}\n\n"])
            .unwrap();
    assert_eq!(turn.content, "joined");
}

#[test]
fn decodes_openai_stream_split_at_every_byte() {
    let input =
        b"data: {\"choices\":[{\"delta\":{\"content\":\"hello\"}}]}\r\n\r\ndata: [DONE]\n\n";
    let chunks = one_byte_chunks(input);
    let turn = decode_chunks(&chunks).unwrap();
    assert_eq!(turn.content, "hello");
}

#[test]
fn supports_utf8_split_points_for_cyrillic_and_emoji() {
    let stream = "data: {\"choices\":[{\"delta\":{\"content\":\"Привет 😀\"}}]}\n\n";
    for split in 1..stream.len() {
        let turn =
            decode_chunks(&[&stream.as_bytes()[..split], &stream.as_bytes()[split..]]).unwrap();
        assert_eq!(turn.content, "Привет 😀", "split at {split}");
    }
}

#[test]
fn rejects_invalid_utf8_after_valid_prefix() {
    let error = decode_chunks(&[b"data: valid ", &[0xf0, 0x28, 0x8c, 0x28], b"\n\n"]).unwrap_err();
    assert!(error.contains("Invalid UTF-8"));
    assert!(error.contains("byte 12"));
}

#[test]
fn malformed_json_is_an_error_with_context() {
    let error = decode_chunks(&[b"event: message\ndata: {bad}\n\n"]).unwrap_err();
    assert!(error.contains("Malformed JSON"));
    assert!(error.contains("event=message"));
    assert!(error.contains("{bad}"));
}

#[test]
fn empty_choices_and_missing_delta_are_allowed() {
    let turn = decode_chunks(&[
        b"data: {\"choices\":[]}\n\n",
        b"data: {\"choices\":[{\"finish_reason\":null}]}\n\n",
    ])
    .unwrap();
    assert!(turn.content.is_empty());
    assert!(turn.finish_reason.is_none());
}

#[test]
fn rejects_multiple_choices() {
    let error =
        decode_chunks(&[b"data: {\"choices\":[{\"delta\":{}},{\"delta\":{}}]}\n\n"]).unwrap_err();
    assert!(error.contains("multi-choice"));
    assert!(error.contains("received 2"));
}

#[test]
fn rejects_non_string_finish_reason() {
    let error = decode_chunks(&[b"data: {\"choices\":[{\"delta\":{},\"finish_reason\":7}]}\n\n"])
        .unwrap_err();
    assert!(error.contains("finish_reason"));
}

#[test]
fn accumulates_interleaved_tool_calls_and_emits_only_argument_deltas() {
    let deltas = Arc::new(Mutex::new(Vec::new()));
    let captured = deltas.clone();
    let callbacks = Callbacks {
        on_delta: &|_| {},
        on_reasoning: &|_| {},
        on_reasoning_name: &|_| {},
        on_reasoning_end: &|| {},
        on_tool_args: &move |id, delta| {
            captured
                .lock()
                .unwrap()
                .push((id.to_string(), delta.to_string()));
        },
    };
    let mut accumulator = Accumulator::new(callbacks);
    let mut parser = SseParser::default();
    let mut format = StreamFormat::Unknown;
    let input = concat!(
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":1,\"id\":\"b\",\"function\":{\"name\":\"to\",\"arguments\":\"{\\\"b\\\":\"},\"vendor\":true}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"a\",\"function\":{\"name\":\"fi\",\"arguments\":\"{\\\"a\\\":\"}}]}}]}\n\n",
        "data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":1,\"function\":{\"name\":\"ol\",\"arguments\":\"2}\"}},{\"index\":0,\"function\":{\"name\":\"le\",\"arguments\":\"1}\"}}]}}]}\n\n"
    );
    for event in parser.push(input.as_bytes()).unwrap() {
        dispatch_event(event, &mut format, &mut accumulator).unwrap();
    }
    let turn = accumulator.finish().unwrap();
    assert_eq!(turn.tool_calls[0].function.name, "file");
    assert_eq!(turn.tool_calls[0].function.arguments, "{\"a\":1}");
    assert_eq!(turn.tool_calls[1].function.name, "tool");
    assert_eq!(turn.tool_calls[1].function.arguments, "{\"b\":2}");
    assert_eq!(turn.tool_calls[1].extra_fields["vendor"], true);
    assert_eq!(deltas.lock().unwrap().len(), 4);
    assert_eq!(deltas.lock().unwrap()[2].1, "2}");
}

#[test]
fn rejects_tool_calls_without_index() {
    let error = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"id\":\"a\",\"function\":{\"arguments\":\"{}\"}}]}}]}\n\n",
    ])
    .unwrap_err();
    assert!(error.contains("missing required index"));
}

#[test]
fn supports_legacy_function_call_with_split_name_and_arguments() {
    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"function_call\":{\"name\":\"get_\",\"arguments\":\"{\"}}}]}\n\n",
        b"data: {\"choices\":[{\"delta\":{\"function_call\":{\"name\":\"time\",\"arguments\":\"}\",\"x\":1}}}]}\n\n",
    ])
    .unwrap();
    assert_eq!(turn.tool_calls[0].function.name, "get_time");
    assert_eq!(turn.tool_calls[0].function.arguments, "{}");
    assert_eq!(turn.tool_calls[0].function.extra_fields["x"], 1);
}

#[test]
fn maps_openai_usage_and_finish_reason() {
    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"length\"}],\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":2,\"total_tokens\":5,\"cache_read_input_tokens\":1}}\n\n",
    ])
    .unwrap();
    assert_eq!(turn.finish_reason.as_deref(), Some("length"));
    let usage = turn.usage.unwrap();
    assert_eq!(usage.total_tokens, 5);
    assert_eq!(usage.cache_read_input_tokens, Some(1));
}

#[test]
fn decodes_native_anthropic_text_thinking_tool_usage_and_stop() {
    let stream = concat!(
        "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":5,\"cache_creation_input_tokens\":2}}}\n\n",
        "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"thinking\",\"thinking\":\"why \"}}\n\n",
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"now\"}}\n\n",
        "event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":0}\n\n",
        "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":1,\"content_block\":{\"type\":\"text\",\"text\":\"Hi \"}}\n\n",
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"text_delta\",\"text\":\"there\"}}\n\n",
        "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":2,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_1\",\"name\":\"read\",\"input\":{}}}\n\n",
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":2,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"path\\\":\"}}\n\n",
        "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":2,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"\\\"x\\\"}\"}}\n\n",
        "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\"},\"usage\":{\"output_tokens\":7,\"cache_read_input_tokens\":3}}\n\n",
        "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
    );
    let chunks = one_byte_chunks(stream.as_bytes());
    let turn = decode_chunks(&chunks).unwrap();
    assert_eq!(turn.reasoning_content.as_deref(), Some("why now"));
    assert_eq!(turn.content, "Hi there");
    assert_eq!(turn.tool_calls[0].id, "toolu_1");
    assert_eq!(turn.tool_calls[0].function.arguments, "{\"path\":\"x\"}");
    assert_eq!(turn.finish_reason.as_deref(), Some("tool_use"));
    let usage = turn.usage.unwrap();
    assert_eq!((usage.prompt_tokens, usage.completion_tokens), (5, 7));
    assert_eq!(usage.cache_creation_input_tokens, Some(2));
    assert_eq!(usage.cache_read_input_tokens, Some(3));
}

#[test]
fn anthropic_error_event_fails_and_done_is_not_accepted() {
    let error = decode_chunks(&[
        b"event: error\ndata: {\"type\":\"error\",\"error\":{\"type\":\"overloaded_error\",\"message\":\"busy\"}}\n\n",
    ])
    .unwrap_err();
    assert!(error.contains("Anthropic stream error"));
    assert!(error.contains("busy"));

    let error = decode_chunks(&[b"event: ping\ndata: [DONE]\n\n"]).unwrap_err();
    assert!(error.contains("Malformed JSON"));
}

#[test]
fn strict_reasoning_tags_and_literal_tags() {
    for literal in ["<thinker>x", "<thinking>x", "<thoughtful>x"] {
        let json = format!(
            "data: {{\"choices\":[{{\"delta\":{{\"content\":{}}}}}]}}\n\n",
            serde_json::to_string(literal).unwrap()
        );
        let turn = decode_chunks(&[json.as_bytes()]).unwrap();
        assert_eq!(turn.content, literal);
        assert!(turn.reasoning_content.is_none());
    }
    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"content\":\"ordinary <think>literal</think>\"}}]}\n\n",
    ])
    .unwrap();
    assert_eq!(turn.content, "ordinary <think>literal</think>");
}

#[test]
fn reasoning_tags_survive_every_byte_split_and_open_tag_at_eof() {
    for tag in ["think", "thought", "ThInK"] {
        let text = format!("<{tag} name=\"analysis\">reason</{tag}>answer");
        let payload = format!(
            "data: {{\"choices\":[{{\"delta\":{{\"content\":{}}}}}]}}\n\n",
            serde_json::to_string(&text).unwrap()
        );
        let chunks = one_byte_chunks(payload.as_bytes());
        let turn = decode_chunks(&chunks).unwrap();
        assert_eq!(turn.reasoning_content.as_deref(), Some("reason"));
        assert_eq!(turn.reasoning_name.as_deref(), Some("analysis"));
        assert_eq!(turn.content, "answer");
    }

    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"content\":\"<think>unfinished\"}}]}\n\n",
    ])
    .unwrap();
    assert_eq!(turn.reasoning_content.as_deref(), Some("unfinished"));
}

#[test]
fn native_reasoning_then_content_ends_reasoning_without_tag_confusion() {
    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"analysis\",\"content\":\"answer\"}}]}\n\n",
    ])
    .unwrap();
    assert_eq!(turn.reasoning_content.as_deref(), Some("analysis"));
    assert_eq!(turn.content, "answer");
}

#[test]
fn native_reasoning_extracts_work_title_protocol() {
    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"<thought name=\\\"Refine file tree interactions\\\">inspect code</thought>\",\"content\":\"answer\"}}]}\n\n",
    ])
    .unwrap();
    assert_eq!(
        turn.reasoning_name.as_deref(),
        Some("Refine file tree interactions")
    );
    assert_eq!(turn.reasoning_content.as_deref(), Some("inspect code"));
    assert_eq!(turn.content, "answer");
}

#[test]
fn null_openai_reasoning_delta_is_ignored() {
    let turn = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"reasoning\":null,\"reasoning_content\":null,\"content\":\"answer\"}}]}\n\n",
    ])
    .unwrap();
    assert_eq!(turn.content, "answer");
    assert!(turn.reasoning_content.is_none());
}

#[test]
fn invalid_openai_reasoning_type_has_payload_context() {
    let error = decode_chunks(&[
        b"data: {\"choices\":[{\"delta\":{\"reasoning\":{\"unexpected\":true}}}]}\n\n",
    ])
    .unwrap_err();
    assert!(error.contains("reasoning delta is not a string or null"));
    assert!(error.contains("unexpected"));
}

#[test]
fn reasoning_open_and_close_tags_can_split_between_provider_events() {
    let pieces = [
        "<",
        "th",
        "ink",
        " name=\"n\"",
        ">why<",
        "/tho",
        "ught",
        ">ok",
    ];
    let events = pieces
        .iter()
        .map(|piece| {
            format!(
                "data: {{\"choices\":[{{\"delta\":{{\"content\":{}}}}}]}}\n\n",
                serde_json::to_string(piece).unwrap()
            )
        })
        .collect::<String>();
    let turn = decode_chunks(&[events.as_bytes()]).unwrap();
    assert_eq!(turn.reasoning_content.as_deref(), Some("why"));
    assert_eq!(turn.reasoning_name.as_deref(), Some("n"));
    assert_eq!(turn.content, "ok");
}

#[tokio::test]
async fn cancellation_interrupts_waiting_for_response_chunks() {
    use tokio::io::AsyncWriteExt;

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        let (mut socket, _) = listener.accept().await.unwrap();
        socket
            .write_all(
                b"HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nTransfer-Encoding: chunked\r\n\r\n",
            )
            .await
            .unwrap();
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
    });
    let response = reqwest::get(format!("http://{address}")).await.unwrap();
    let cancel = Arc::new(AtomicBool::new(false));
    let cancel_for_task = cancel.clone();
    let parser = tokio::spawn(async move {
        super::parse_sse_stream(
            response,
            &cancel_for_task,
            &|_| {},
            &|_| {},
            &|_| {},
            &|| {},
            &|_, _| {},
        )
        .await
    });
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    cancel.store(true, Ordering::Relaxed);
    let result = tokio::time::timeout(std::time::Duration::from_secs(1), parser)
        .await
        .unwrap()
        .unwrap();
    assert_eq!(result.unwrap_err(), "Aborted");
    server.abort();
}
