use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::agent::Agent;
use crate::chat::{ChatMessage, ToolCall, ToolCallFunction};
use crate::executor::ToolExecutor;
use crate::request::stream_chat;

const MAX_TURNS: usize = 25;

/// Keep tool failures useful to the model as a diagnostic hint. The UI filters
/// messages carrying this marker instead of rendering raw error output.
fn tool_error_hint(error: String) -> String {
    format!("[tool-error] Tool execution failed. Hint: {error}")
}

struct SharedBuffer {
    buf: String,
    last_emit: std::time::Instant,
}

fn clean_tool_calls(tool_calls: Vec<ToolCall>) -> Vec<ToolCall> {
    tool_calls
        .into_iter()
        .filter_map(|call| {
            let name = call.function.name.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let args_str = call.function.arguments.clone();
            if args_str.trim().is_empty() {
                return Some(ToolCall {
                    id: call.id,
                    type_: "function".to_string(),
                    function: ToolCallFunction {
                        name,
                        arguments: args_str,
                        extra_fields: call.function.extra_fields,
                    },
                    extra_fields: call.extra_fields,
                });
            }
            match serde_json::from_str::<serde_json::Value>(&args_str) {
                Ok(mut parsed) if parsed.is_object() => {
                    if let Some(obj) = parsed.as_object_mut() {
                        if obj.contains_key("done") {
                            obj.remove("done");
                            if obj.is_empty() {
                                return None;
                            }
                        }
                    }
                    let cleaned = serde_json::to_string(&parsed).unwrap_or(args_str);
                    Some(ToolCall {
                        id: call.id,
                        type_: "function".to_string(),
                        function: ToolCallFunction {
                            name,
                            arguments: cleaned,
                            extra_fields: call.function.extra_fields,
                        },
                        extra_fields: call.extra_fields,
                    })
                }
                _ => Some(ToolCall {
                    id: call.id,
                    type_: "function".to_string(),
                    function: ToolCallFunction {
                        name,
                        arguments: args_str,
                        extra_fields: call.function.extra_fields,
                    },
                    extra_fields: call.extra_fields,
                }),
            }
        })
        .collect()
}

fn take_file_snapshot(path: &str) -> Option<crate::snapshot::FileSnapshot> {
    let content = std::fs::read_to_string(path).ok();
    Some(crate::snapshot::FileSnapshot {
        path: path.to_string(),
        content,
    })
}

impl Agent {
    pub fn add_user_message(
        &mut self,
        input: String,
        content_parts: Option<Vec<serde_json::Value>>,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) {
        let content: serde_json::Value;
        let display: String;

        if let Some(parts) = content_parts {
            display = parts
                .iter()
                .filter_map(|p| {
                    if p.get("type").and_then(|v| v.as_str()) == Some("text") {
                        p.get("text")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
            if parts.len() == 1 && parts[0].get("type").and_then(|v| v.as_str()) == Some("text") {
                content = parts[0]
                    .get("text")
                    .and_then(|v| v.as_str())
                    .map(|s| serde_json::Value::String(s.to_string()))
                    .unwrap_or(serde_json::Value::Array(parts));
            } else {
                content = serde_json::Value::Array(parts);
            }
        } else {
            display = input.clone();
            content = serde_json::Value::String(input);
        }

        if self.config().api_key.is_empty() {
            emit(
                "vibe:agent:error",
                serde_json::json!({"text": "API not connected. Open Settings to add a provider."}),
            );
            return;
        }

        self.messages.push(ChatMessage {
            role: "user".to_string(),
            content: Some(content),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
            usage: None,
        });

        let user_index = self.messages.len() - 1;
        emit(
            "vibe:agent:user",
            serde_json::json!({"text": display, "index": user_index}),
        );
        emit("vibe:agent:busy", serde_json::json!({"busy": true}));
    }

    pub async fn send(
        &mut self,
        executor: &dyn ToolExecutor,
        client: &reqwest::Client,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    ) {
        // Do NOT unconditionally reset the cancel flag here — the user may
        // have already pressed Stop between agent_send extracting the cancel
        // token and this point.  Instead, check it and bail out immediately.
        if self.cancel.load(Ordering::Relaxed) {
            self.cancel.store(false, Ordering::Relaxed);
            emit("vibe:agent:stopped", serde_json::Value::Null);
            emit("vibe:agent:busy", serde_json::json!({"busy": false}));
            return;
        }

        let tool_defs = executor.definitions();
        let cwd = self.config().cwd.clone();
        let llm_config = self.config().llm_config();

        for _turn in 0..MAX_TURNS {
            if self.cancel.load(Ordering::Relaxed) {
                emit("vibe:agent:stopped", serde_json::Value::Null);
                break;
            }

            // Proactive context management: when usage crosses the threshold,
            // compact the middle of the conversation into a structured LLM
            // summary (main goal / completed / next goals / critical context)
            // before the request is built.
            self.maybe_compact_context(client, emit).await;

            emit("vibe:agent:assistant-start", serde_json::Value::Null);

            // Coalesce streaming deltas. Leading edge: the very first chunk is
            // emitted immediately (last_emit starts one debounce window in the
            // past). A ticker in the select loop below flushes any residue, so
            // text never stalls in the buffer when the model pauses or switches
            // to tool calls mid-stream.
            let debounce = Duration::from_millis(16);
            let stream_epoch = std::time::Instant::now()
                .checked_sub(debounce)
                .unwrap_or_else(std::time::Instant::now);
            let chunk_buf = Arc::new(Mutex::new(SharedBuffer {
                buf: String::new(),
                last_emit: stream_epoch,
            }));
            let reason_buf = Arc::new(Mutex::new(SharedBuffer {
                buf: String::new(),
                last_emit: stream_epoch,
            }));
            let reason_name = Arc::new(Mutex::new(None::<String>));
            // Tool-call argument deltas, coalesced per call id (order-preserving).
            let tool_buf: Arc<Mutex<Vec<(String, String)>>> = Arc::new(Mutex::new(Vec::new()));

            let cb_chunk = {
                let chunk_buf = chunk_buf.clone();
                move |chunk: &str| {
                    if let Ok(mut sb) = chunk_buf.lock() {
                        sb.buf.push_str(chunk);
                        let now = std::time::Instant::now();
                        if now.duration_since(sb.last_emit) >= debounce {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = now;
                            drop(sb);
                            emit(
                                "vibe:agent:assistant-chunk",
                                serde_json::json!({"text": text}),
                            );
                        }
                    }
                }
            };

            let cb_reasoning_name = {
                let reason_name = reason_name.clone();
                move |name: &str| {
                    if let Ok(mut state) = reason_name.lock() {
                        *state = Some(name.to_string());
                    }
                    emit(
                        "vibe:agent:reasoning-start",
                        serde_json::json!({"name": name}),
                    );
                }
            };

            let cb_reasoning = {
                let reason_buf = reason_buf.clone();
                let reason_name = reason_name.clone();
                move |chunk: &str| {
                    if let Ok(mut sb) = reason_buf.lock() {
                        sb.buf.push_str(chunk);
                        let now = std::time::Instant::now();
                        if now.duration_since(sb.last_emit) >= debounce {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = now;
                            drop(sb);
                            let current_name = reason_name.lock().ok().and_then(|g| g.clone());
                            let mut payload = serde_json::json!({"text": text});
                            if let Some(ref n) = current_name {
                                payload["name"] = serde_json::Value::String(n.clone());
                            }
                            emit("vibe:agent:reasoning-chunk", payload);
                        }
                    }
                }
            };

            let cb_reasoning_end = {
                let reason_buf = reason_buf.clone();
                let reason_name = reason_name.clone();
                move || {
                    if let Ok(mut sb) = reason_buf.lock() {
                        if !sb.buf.is_empty() {
                            let text = std::mem::take(&mut sb.buf);
                            drop(sb);
                            let current_name = reason_name.lock().ok().and_then(|g| g.clone());
                            let mut payload = serde_json::json!({"text": text});
                            if let Some(ref n) = current_name {
                                payload["name"] = serde_json::Value::String(n.clone());
                            }
                            emit("vibe:agent:reasoning-chunk", payload);
                        }
                    }
                    emit("vibe:agent:reasoning-end", serde_json::Value::Null);
                }
            };

            // Buffer tool-arg deltas; the ticker below flushes them. Merging
            // consecutive deltas of the same call keeps one event per tick.
            let cb_tool_args = {
                let tool_buf = tool_buf.clone();
                move |tool_id: &str, args: &str| {
                    if let Ok(mut tb) = tool_buf.lock() {
                        if let Some(last) = tb.last_mut() {
                            if last.0 == tool_id {
                                last.1.push_str(args);
                                return;
                            }
                        }
                        tb.push((tool_id.to_string(), args.to_string()));
                    }
                }
            };

            let flush_stream_buffers = {
                let chunk_buf = chunk_buf.clone();
                let reason_buf = reason_buf.clone();
                let reason_name = reason_name.clone();
                let tool_buf = tool_buf.clone();
                move || {
                    if let Ok(mut sb) = chunk_buf.lock() {
                        if !sb.buf.is_empty() {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = std::time::Instant::now();
                            drop(sb);
                            emit(
                                "vibe:agent:assistant-chunk",
                                serde_json::json!({"text": text}),
                            );
                        }
                    }
                    if let Ok(mut sb) = reason_buf.lock() {
                        if !sb.buf.is_empty() {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = std::time::Instant::now();
                            drop(sb);
                            let current_name = reason_name.lock().ok().and_then(|g| g.clone());
                            let mut payload = serde_json::json!({"text": text});
                            if let Some(ref n) = current_name {
                                payload["name"] = serde_json::Value::String(n.clone());
                            }
                            emit("vibe:agent:reasoning-chunk", payload);
                        }
                    }
                    let drained: Vec<(String, String)> = tool_buf
                        .lock()
                        .map(|mut tb| std::mem::take(&mut *tb))
                        .unwrap_or_default();
                    for (id, args) in drained {
                        // `delta: true` — payload carries only the new fragment;
                        // the frontend accumulates. Events without the flag
                        // (e.g. sub-agent status) keep replace semantics.
                        emit(
                            "vibe:agent:tool-chunk",
                            serde_json::json!({"id": id, "args": args, "delta": true}),
                        );
                    }
                }
            };

            let stream_fut = stream_chat(
                &llm_config,
                self.messages.clone(),
                tool_defs.clone(),
                &self.cancel,
                client,
                &cb_chunk,
                &cb_reasoning,
                &cb_reasoning_name,
                &cb_reasoning_end,
                &cb_tool_args,
            );
            tokio::pin!(stream_fut);

            // Drive the stream and flush residue on a UI-frame cadence so text
            // never sits in a buffer when the model pauses mid-stream.
            let turn_result = loop {
                tokio::select! {
                    res = &mut stream_fut => break res,
                    _ = tokio::time::sleep(debounce) => flush_stream_buffers(),
                }
            };
            flush_stream_buffers();

            let turn_result = match turn_result {
                Ok(r) => r,
                Err(e) => {
                    if e == "Aborted" {
                        emit("vibe:agent:stopped", serde_json::Value::Null);
                    } else {
                        emit("vibe:agent:error", serde_json::json!({"text": e}));
                    }
                    break;
                }
            };

            if let Some(ref u) = turn_result.usage {
                if u.prompt_tokens > 0 {
                    self.last_prompt_tokens = Some(u.prompt_tokens);
                }
                // Anthropic prompt caching metrics (None on other providers).
                self.last_cache_creation_tokens = u.cache_creation_input_tokens;
                self.last_cache_read_tokens = u.cache_read_input_tokens;
                emit(
                    "vibe:agent:usage",
                    serde_json::json!({
                        "promptTokens": u.prompt_tokens,
                        "completionTokens": u.completion_tokens,
                        "totalTokens": u.total_tokens,
                        "cacheCreationInputTokens": u.cache_creation_input_tokens,
                        "cacheReadInputTokens": u.cache_read_input_tokens,
                    }),
                );
            }

            let mut content_text = turn_result.content.trim().to_string();
            let noise_phrases = [
                "done",
                "done.",
                "finished",
                "finished.",
                "completed",
                "completed.",
            ];
            if noise_phrases.contains(&content_text.as_str()) {
                content_text.clear();
            }

            let cleaned_tool_calls = clean_tool_calls(turn_result.tool_calls);
            emit("vibe:agent:assistant-end", serde_json::Value::Null);

            let assistant_content = if content_text.is_empty() {
                None
            } else {
                Some(serde_json::Value::String(content_text.clone()))
            };

            // Reasoning is stored ONLY in `reasoning_content` and round-tripped
            // natively by `messages_to_api_json`. Do not re-encode it as a
            // <thought> text block: that duplicates reasoning in the history
            // and breaks providers (e.g. DeepSeek) that expect the native field.

            self.messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: assistant_content,
                name: None,
                tool_call_id: None,
                tool_calls: if cleaned_tool_calls.is_empty() {
                    None
                } else {
                    Some(cleaned_tool_calls.clone())
                },
                reasoning_content: turn_result.reasoning_content.clone(),
                reasoning_name: turn_result.reasoning_name.clone(),
                usage: turn_result.usage.clone(),
            });

            if cleaned_tool_calls.is_empty() {
                if !content_text.is_empty() {
                    emit("vibe:agent:done", serde_json::Value::Null);
                } else if turn_result.content.trim().is_empty() {
                    emit(
                        "vibe:agent:error",
                        serde_json::json!({"text":
                            "Model returned an empty response. This can happen if the prompt \
                             was blocked or the model failed to generate a response."
                        }),
                    );
                }
                break;
            }

            let is_all_read_only = cleaned_tool_calls.len() > 1
                && cleaned_tool_calls
                    .iter()
                    .all(|c| executor.is_read_only(&c.function.name));

            if is_all_read_only {
                let mut prepared_calls = Vec::new();
                for call in &cleaned_tool_calls {
                    if self.cancel.load(Ordering::Relaxed) {
                        break;
                    }
                    let tool_name = &call.function.name;
                    let args_str = &call.function.arguments;
                    let parsed_args: serde_json::Value = if args_str.trim().is_empty() {
                        serde_json::Value::Object(serde_json::Map::new())
                    } else {
                        match serde_json::from_str(args_str) {
                            Ok(v) => v,
                            Err(e) => {
                                let err_msg =
                                    tool_error_hint(format!("Invalid JSON arguments: {e}"));
                                emit(
                                    "vibe:agent:tool-result",
                                    serde_json::json!({
                                        "id": call.id, "ok": false, "text": err_msg,
                                    }),
                                );
                                self.messages.push(ChatMessage {
                                    role: "tool".to_string(),
                                    content: Some(serde_json::Value::String(err_msg)),
                                    name: None,
                                    tool_call_id: Some(call.id.clone()),
                                    tool_calls: None,
                                    reasoning_content: None,
                                    reasoning_name: None,
                                    usage: None,
                                });
                                continue;
                            }
                        }
                    };

                    emit(
                        "vibe:agent:tool-call",
                        serde_json::json!({"id": call.id, "name": tool_name, "args": parsed_args}),
                    );
                    prepared_calls.push((call, tool_name.clone(), parsed_args));
                }

                let execution_futs =
                    prepared_calls
                        .iter()
                        .map(|(_call, tool_name, parsed_args)| {
                            executor.execute(tool_name, parsed_args, &cwd, &self.cancel, emit)
                        });

                let results = futures::future::join_all(execution_futs).await;

                for ((call, _, _), result) in prepared_calls.into_iter().zip(results) {
                    let is_ok = result.is_ok();
                    let result_text = result.unwrap_or_else(tool_error_hint);

                    emit(
                        "vibe:agent:tool-result",
                        serde_json::json!({
                            "id": call.id, "ok": is_ok, "text": result_text,
                        }),
                    );

                    self.messages.push(ChatMessage {
                        role: "tool".to_string(),
                        content: Some(serde_json::Value::String(result_text)),
                        name: None,
                        tool_call_id: Some(call.id.clone()),
                        tool_calls: None,
                        reasoning_content: None,
                        reasoning_name: None,
                        usage: None,
                    });
                }
            } else {
                for call in &cleaned_tool_calls {
                    if self.cancel.load(Ordering::Relaxed) {
                        break;
                    }

                    let tool_name = &call.function.name;
                    let args_str = &call.function.arguments;

                    let parsed_args: serde_json::Value = if args_str.trim().is_empty() {
                        serde_json::Value::Object(serde_json::Map::new())
                    } else {
                        match serde_json::from_str(args_str) {
                            Ok(v) => v,
                            Err(e) => {
                                let err_msg =
                                    tool_error_hint(format!("Invalid JSON arguments: {e}"));
                                emit(
                                    "vibe:agent:tool-result",
                                    serde_json::json!({
                                        "id": call.id, "ok": false, "text": err_msg,
                                    }),
                                );
                                self.messages.push(ChatMessage {
                                    role: "tool".to_string(),
                                    content: Some(serde_json::Value::String(err_msg)),
                                    name: None,
                                    tool_call_id: Some(call.id.clone()),
                                    tool_calls: None,
                                    reasoning_content: None,
                                    reasoning_name: None,
                                    usage: None,
                                });
                                continue;
                            }
                        }
                    };

                    emit(
                        "vibe:agent:tool-call",
                        serde_json::json!({"id": call.id, "name": tool_name, "args": parsed_args}),
                    );

                    // Snapshot files before write/edit
                    let is_modify = tool_name == "write_file" || tool_name == "edit_file";
                    let snap_path = if is_modify {
                        parsed_args.get("path").and_then(|v| v.as_str()).map(|p| {
                            if std::path::Path::new(p).is_absolute() {
                                p.to_string()
                            } else {
                                std::path::Path::new(&cwd)
                                    .join(p)
                                    .to_string_lossy()
                                    .to_string()
                            }
                        })
                    } else {
                        None
                    };
                    let snapshot = snap_path.as_ref().and_then(|p| take_file_snapshot(p));

                    let result = executor
                        .execute(tool_name, &parsed_args, &cwd, &self.cancel, emit)
                        .await;
                    let is_ok = result.is_ok();
                    let result_text = result.unwrap_or_else(tool_error_hint);

                    // Store snapshot if file was modified
                    if let Some(snap) = snapshot {
                        let msg_idx = self.messages.len();
                        self.file_snapshots.push(crate::snapshot::SnapshotEntry {
                            message_index: msg_idx,
                            snapshot: snap,
                        });
                    }

                    emit(
                        "vibe:agent:tool-result",
                        serde_json::json!({
                            "id": call.id, "ok": is_ok, "text": result_text,
                        }),
                    );

                    self.messages.push(ChatMessage {
                        role: "tool".to_string(),
                        content: Some(serde_json::Value::String(result_text)),
                        name: None,
                        tool_call_id: Some(call.id.clone()),
                        tool_calls: None,
                        reasoning_content: None,
                        reasoning_name: None,
                        usage: None,
                    });
                }
            }
        }

        // Reset cancel flag for the next send cycle
        self.cancel.store(false, Ordering::Relaxed);
        emit("vibe:agent:busy", serde_json::json!({"busy": false}));
    }
}
