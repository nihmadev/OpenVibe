use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use agent::chat::ChatMessage;
use agent::config::LlmConfig;
use agent::prompt::agent_system_prompt;
use agent::request::stream_chat;
use agent::sub_trace::{store_sub_event, SubTraceEvent};
use agent::ToolDefinition;

use crate::definition::build_readonly_tool_definitions;
use crate::{bash, list_dir, read, search};

// A research helper should converge quickly. Long autonomous explorations are
// especially harmful because every tool result is fed back into its context.
const MAX_TURNS: usize = 12;
const MAX_TOOL_CALLS: usize = 100;

static SUB_AGENT_CLIENT: std::sync::OnceLock<reqwest::Client> = std::sync::OnceLock::new();

fn get_sub_agent_client() -> &'static reqwest::Client {
    SUB_AGENT_CLIENT.get_or_init(|| {
        reqwest::Client::builder()
            .pool_max_idle_per_host(2)
            .pool_idle_timeout(std::time::Duration::from_secs(60))
            .http2_keep_alive_interval(Some(std::time::Duration::from_secs(30)))
            .http2_keep_alive_timeout(std::time::Duration::from_secs(5))
            .tcp_keepalive(Some(std::time::Duration::from_secs(15)))
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_nodelay(true)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    })
}

pub async fn execute(
    cwd: &str,
    args: &serde_json::Value,
    cancel: &AtomicBool,
    emit: &(dyn for<'a> Fn(&'a str, serde_json::Value) + Send + Sync),
    llm_config: Option<LlmConfig>,
) -> Result<String, String> {
    let task = args
        .get("task")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing 'task' argument".to_string())?;

    let sub_system = agent_system_prompt(cwd);

    let read_only_tools: Vec<ToolDefinition> = build_readonly_tool_definitions();

    let config = llm_config.ok_or_else(|| "Sub-agent: LLM not configured".to_string())?;

    let client = get_sub_agent_client();
    let cancel_sub = Arc::new(AtomicBool::new(false));
    let mut sub_messages: Vec<ChatMessage> = vec![
        ChatMessage {
            role: "system".to_string(),
            content: Some(serde_json::Value::String(sub_system)),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
        },
        ChatMessage {
            role: "user".to_string(),
            content: Some(serde_json::Value::String(task.to_string())),
            name: None,
            tool_call_id: None,
            tool_calls: None,
            reasoning_content: None,
            reasoning_name: None,
        },
    ];

    let mut full_result = String::new();
    let mut tool_calls_used = 0usize;

    for _turn in 0..MAX_TURNS {
        if cancel.load(Ordering::Relaxed) {
            return Err("Aborted".to_string());
        }

        let available_tools = if tool_calls_used >= MAX_TOOL_CALLS {
            Vec::new()
        } else {
            read_only_tools.clone()
        };
        let turn = stream_chat(
            &config,
            sub_messages.clone(),
            available_tools,
            &cancel_sub,
            client,
            &|_| {},
            &|_| {},
            &|_| {},
            &|| {},
            &|_, _| {},
        )
        .await?;

        if !turn.content.trim().is_empty() {
            full_result.push_str(&turn.content);
            full_result.push('\n');
            emit(
                "vibe:agent:tool-chunk",
                serde_json::json!({"id": "sub-agent", "args": serde_json::json!({"status": &turn.content}).to_string()}),
            );
            store_sub_event(
                "sub-agent",
                SubTraceEvent {
                    kind: "chunk".to_string(),
                    text: Some(turn.content.clone()),
                    id: None,
                    name: None,
                    args: None,
                    ok: None,
                },
            );
        }

        if turn.tool_calls.is_empty() {
            store_sub_event(
                "sub-agent",
                SubTraceEvent {
                    kind: "done".to_string(),
                    text: None,
                    id: None,
                    name: None,
                    args: None,
                    ok: None,
                },
            );
            return Ok(full_result.trim().to_string());
        }

        let mut sub_content = if turn.content.trim().is_empty() {
            None
        } else {
            Some(serde_json::Value::String(turn.content.clone()))
        };

        if !turn.tool_calls.is_empty() {
            let reasoning = turn.reasoning_content.as_deref().unwrap_or("");
            let tag_name = turn.reasoning_name.as_deref().unwrap_or("Thinking");
            let thought_text = if reasoning.trim().is_empty() {
                "Analyzing and preparing tool execution."
            } else {
                reasoning.trim()
            };
            let thought_block = format!(
                "<thought name=\"{}\">\n{}\n</thought>",
                tag_name, thought_text
            );

            let current_text = match &sub_content {
                Some(serde_json::Value::String(s)) => s.clone(),
                _ => String::new(),
            };

            if !current_text.contains("<thought") {
                let new_text = if current_text.trim().is_empty() {
                    thought_block
                } else {
                    format!("{}\n{}", thought_block, current_text)
                };
                sub_content = Some(serde_json::Value::String(new_text));
            }
        }

        // Preserve the assistant tool-call message so every following tool
        // result has a valid parent in the provider conversation protocol.
        sub_messages.push(ChatMessage {
            role: "assistant".to_string(),
            content: sub_content,
            name: None,
            tool_call_id: None,
            tool_calls: Some(turn.tool_calls.clone()),
            reasoning_content: turn.reasoning_content.clone(),
            reasoning_name: turn.reasoning_name.clone(),
        });

        let mut prepared_calls = Vec::new();
        for call in &turn.tool_calls {
            if cancel.load(Ordering::Relaxed) {
                return Err("Aborted".to_string());
            }

            let tool_name = &call.function.name;
            let args_str = &call.function.arguments;

            if tool_calls_used >= MAX_TOOL_CALLS {
                sub_messages.push(ChatMessage {
                    role: "tool".to_string(),
                    content: Some(serde_json::Value::String(
                        "Research tool budget exhausted. Summarize the evidence already collected."
                            .to_string(),
                    )),
                    name: None,
                    tool_call_id: Some(call.id.clone()),
                    tool_calls: None,
                    reasoning_content: None,
                    reasoning_name: None,
                });
                continue;
            }
            tool_calls_used += 1;

            let parsed_args: serde_json::Value = if args_str.trim().is_empty() {
                serde_json::Value::Object(serde_json::Map::new())
            } else {
                match serde_json::from_str(args_str) {
                    Ok(v) => v,
                    Err(e) => {
                        sub_messages.push(ChatMessage {
                            role: "tool".to_string(),
                            content: Some(serde_json::Value::String(format!("Invalid JSON: {e}"))),
                            name: None,
                            tool_call_id: Some(call.id.clone()),
                            tool_calls: None,
                            reasoning_content: None,
                            reasoning_name: None,
                        });
                        continue;
                    }
                }
            };

            store_sub_event(
                "sub-agent",
                SubTraceEvent {
                    kind: "tool-call".to_string(),
                    text: None,
                    id: Some(call.id.clone()),
                    name: Some(tool_name.clone()),
                    args: Some(parsed_args.clone()),
                    ok: None,
                },
            );

            prepared_calls.push((call, tool_name.clone(), parsed_args));
        }

        let futures = prepared_calls
            .iter()
            .map(|(_call, tool_name, parsed_args)| async move {
                match tool_name.as_str() {
                    "read_file" => read::tool_read_file(cwd, parsed_args).await,
                    "search_codebase" => search::tool_search_codebase(cwd, parsed_args).await,
                    "list_dir" => list_dir::tool_list_dir(cwd, parsed_args).await,
                    "bash" => bash::tool_bash(cwd, parsed_args, cancel).await,
                    _ => Err(format!("Unknown tool: {tool_name}")),
                }
            });

        let results = futures::future::join_all(futures).await;

        for ((call, _, _), result) in prepared_calls.into_iter().zip(results) {
            let is_ok = result.is_ok();
            let result_text = result.unwrap_or_else(|e| e);

            store_sub_event(
                "sub-agent",
                SubTraceEvent {
                    kind: "tool-result".to_string(),
                    text: Some(result_text.clone()),
                    id: Some(call.id.clone()),
                    name: None,
                    args: None,
                    ok: Some(is_ok),
                },
            );

            sub_messages.push(ChatMessage {
                role: "tool".to_string(),
                content: Some(serde_json::Value::String(result_text)),
                name: None,
                tool_call_id: Some(call.id.clone()),
                tool_calls: None,
                reasoning_content: None,
                reasoning_name: None,
            });
        }
    }

    if full_result.trim().is_empty() {
        Ok("[Explore agent reached maximum turns without a conclusive result]".to_string())
    } else {
        Ok(full_result.trim().to_string())
    }
}
