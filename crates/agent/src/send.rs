use std::collections::HashMap;
use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use tokio::sync::oneshot;

use crate::agent::Agent;
use crate::chat::{ChatMessage, ToolCall, ToolCallFunction};
use crate::executor::ToolExecutor;
use crate::request::stream_chat;

const MAX_TURNS: usize = 25;

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
                    },
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
                        },
                    })
                }
                _ => Some(ToolCall {
                    id: call.id,
                    type_: "function".to_string(),
                    function: ToolCallFunction {
                        name,
                        arguments: args_str,
                    },
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
    pub async fn send(
        &mut self,
        input: String,
        content_parts: Option<Vec<serde_json::Value>>,
        executor: &dyn ToolExecutor,
        client: &reqwest::Client,
        emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
        confirm_senders: &mut HashMap<String, oneshot::Sender<String>>,
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
        });

        let user_index = self.messages.len() - 1;
        emit(
            "vibe:agent:user",
            serde_json::json!({"text": display, "index": user_index}),
        );
        emit("vibe:agent:busy", serde_json::json!({"busy": true}));

        let tool_defs = executor.definitions();
        let cwd = self.config().cwd.clone();
        let llm_config = self.config().llm_config();

        for _turn in 0..MAX_TURNS {
            if self.cancel.load(Ordering::Relaxed) {
                break;
            }

            emit("vibe:agent:assistant-start", serde_json::Value::Null);

            let chunk_buf = Arc::new(Mutex::new(SharedBuffer {
                buf: String::new(),
                last_emit: std::time::Instant::now(),
            }));
            let reason_buf = Arc::new(Mutex::new(SharedBuffer {
                buf: String::new(),
                last_emit: std::time::Instant::now(),
            }));
            let debounce = Duration::from_millis(100);

            let cb_chunk = {
                let chunk_buf = chunk_buf.clone();
                let emit = emit;
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

            let cb_reasoning = {
                let reason_buf = reason_buf.clone();
                let emit = emit;
                move |chunk: &str| {
                    if let Ok(mut sb) = reason_buf.lock() {
                        sb.buf.push_str(chunk);
                        let now = std::time::Instant::now();
                        if now.duration_since(sb.last_emit) >= debounce {
                            let text = std::mem::take(&mut sb.buf);
                            sb.last_emit = now;
                            drop(sb);
                            emit(
                                "vibe:agent:reasoning-chunk",
                                serde_json::json!({"text": text}),
                            );
                        }
                    }
                }
            };

            let cb_reasoning_end = {
                let reason_buf = reason_buf.clone();
                let emit = emit;
                move || {
                    if let Ok(mut sb) = reason_buf.lock() {
                        if !sb.buf.is_empty() {
                            let text = std::mem::take(&mut sb.buf);
                            drop(sb);
                            emit(
                                "vibe:agent:reasoning-chunk",
                                serde_json::json!({"text": text}),
                            );
                        }
                    }
                    emit("vibe:agent:reasoning-end", serde_json::Value::Null);
                }
            };

            let turn_result = stream_chat(
                &llm_config,
                self.messages.clone(),
                tool_defs.clone(),
                &self.cancel,
                client,
                &cb_chunk,
                &cb_reasoning,
                &cb_reasoning_end,
                &|tool_id: &str, args: &str| {
                    emit(
                        "vibe:agent:tool-chunk",
                        serde_json::json!({"id": tool_id, "args": args}),
                    );
                },
            )
            .await;

            if let Ok(mut sb) = chunk_buf.lock() {
                if !sb.buf.is_empty() {
                    let text = std::mem::take(&mut sb.buf);
                    drop(sb);
                    emit(
                        "vibe:agent:assistant-chunk",
                        serde_json::json!({"text": text}),
                    );
                }
            }

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

            self.messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: if content_text.is_empty() {
                    None
                } else {
                    Some(serde_json::Value::String(content_text.clone()))
                },
                name: None,
                tool_call_id: None,
                tool_calls: if cleaned_tool_calls.is_empty() {
                    None
                } else {
                    Some(cleaned_tool_calls.clone())
                },
                reasoning_content: turn_result.reasoning_content.clone(),
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
                            let err_msg = format!("Invalid JSON arguments: {e}");
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

                // Confirmation for sensitive tools
                if executor.requires_confirmation(tool_name)
                    && !self.always_allow().contains(&format!("{tool_name}:all"))
                {
                    let (tx, rx) = oneshot::channel();
                    confirm_senders.insert(call.id.clone(), tx);
                    emit(
                        "vibe:agent:confirm-request",
                        serde_json::json!({
                            "id": call.id, "toolName": tool_name, "args": parsed_args,
                        }),
                    );
                    let response = rx.await.unwrap_or_default();
                    if !response.starts_with("y")
                        && response != "1"
                        && response != "always"
                        && response != "aa"
                    {
                        emit(
                            "vibe:agent:tool-denied",
                            serde_json::json!({
                                "id": call.id, "name": tool_name,
                            }),
                        );
                        self.messages.push(ChatMessage {
                            role: "tool".to_string(),
                            content: Some(serde_json::Value::String(
                                "[Tool execution denied by user]".to_string(),
                            )),
                            name: None,
                            tool_call_id: Some(call.id.clone()),
                            tool_calls: None,
                            reasoning_content: None,
                        });
                        continue;
                    }
                    if response == "always" || response == "aa" {
                        self.always_allow_mut().insert(format!("{tool_name}:all"));
                    }
                }

                let result = executor
                    .execute(tool_name, &parsed_args, &cwd, &self.cancel, emit)
                    .await;
                let is_ok = result.is_ok();
                let result_text = result.unwrap_or_else(|e| e);

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
                });
            }
        }

        emit("vibe:agent:busy", serde_json::json!({"busy": false}));
    }
}
