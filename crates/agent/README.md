# `agent` Crate

The `agent` crate provides the core AI agent logic for the OpenVibe ecosystem. It manages interactions with Large Language Models (LLMs), handles system prompts and dynamic context integration, executes event-driven agentic loops, processes Server-Sent Events (SSE) streaming responses, tracks token usage, logs execution traces, and maintains file snapshots for context rollback capabilities.

---

## Overview and Key Features

- **LLM Provider Integration**: Compatible with OpenAI API specifications, allowing seamless integration with OpenAI, DeepSeek, Anthropic, Ollama, and other compatible providers.
- **Streaming & Event Handling**: Parses SSE streams in real time to capture generated content chunks, reasoning steps, tool invocation requests, and error events.
- **Dynamic Prompt Management**: Constructs system prompts with support for workspace configuration and live Smart Context Generation 2 (SCG2) context injection.
- **Snapshot & Rollback System**: Captures file system state snapshots before modifications, allowing granular or full workspace rollbacks (`UndoState`).
- **Context Management**: Monitors token usage, handles long-form conversations via conversation summarization, and truncates historical messages when context limits are reached.
- **Sub-Trace Logging**: Records sub-event traces during multi-step tool executions for debugging and inspection.

---

## Architecture and Modules

| Module | Description |
| :--- | :--- |
| `agent` ([`src/agent.rs`](src/agent.rs)) | Defines the primary `Agent` structure, maintaining conversation history, configuration, cancellation flags, and file snapshot states. |
| `chat` ([`src/chat.rs`](src/chat.rs)) | Contains data structures for messages (`ChatMessage`), function calls (`ToolCall`), and assistant response turns (`AssistantTurn`). |
| `config` ([`src/config.rs`](src/config.rs)) | Manages runtime agent configuration (`AgentConfig`), including model selection, API keys, endpoints, working directory (`cwd`), timeouts, and token limits. |
| `definition` ([`src/definition.rs`](src/definition.rs)) | Defines tool specifications (`ToolDefinition`, `ToolDefFunction`) exposed to the LLM. |
| `events` ([`src/events.rs`](src/events.rs)) | Defines agent life-cycle events (`ChunkEvent`, `ToolCallEvent`, `ToolResultEvent`, `ErrorEvent`, `BusyEvent`). |
| `executor` ([`src/executor.rs`](src/executor.rs)) | Provides the `ToolExecutor` trait for executing requested tools asynchronously. |
| `prompt` ([`src/prompt.rs`](src/prompt.rs)) | Assembles system prompts tailored to the current working directory and SCG2 codebase context. |
| `request` ([`src/request.rs`](src/request.rs)) | Constructs HTTP request payloads for target LLM endpoints. |
| `send` ([`src/send.rs`](src/send.rs)) | Orchestrates the primary execution loop (`send_message`), managing API communications and tool dispatching. |
| `sse` ([`src/sse.rs`](src/sse.rs)) | Implements streaming response parsing for Server-Sent Events. |
| `snapshot` ([`src/snapshot.rs`](src/snapshot.rs)) | Manages file state records (`FileSnapshot`, `SnapshotEntry`) used for state recovery. |
| `rollback` ([`src/rollback.rs`](src/rollback.rs)) | Executes file restoration logic using saved snapshots. |
| `sub_trace` ([`src/sub_trace.rs`](src/sub_trace.rs)) | Tracks detailed internal execution events for debugging. |
| `summarize` ([`src/summarize.rs`](src/summarize.rs)) | Handles context compaction by summarizing long message threads. |
| `token` ([`src/token.rs`](src/token.rs)) | Calculates token counts across conversation messages. |
| `transform` ([`src/transform.rs`](src/transform.rs)) | Normalizes and sanitizes message formats prior to API dispatch. |

---

## Usage Example

```rust
use agent::{Agent, AgentConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize configuration
    let config = AgentConfig {
        api_key: "your-api-key".to_string(),
        base_url: "https://api.openai.com/v1".to_string(),
        model: "gpt-4o".to_string(),
        cwd: "./".to_string(),
        temperature: Some(0.2),
        max_tokens: Some(4096),
        ..Default::default()
    };

    // Create Agent instance
    let mut agent = Agent::new(config);

    // Inject dynamic codebase context
    agent.update_system_prompt(Some("Additional workspace context from SCG2"));

    // Query active message history
    println!("Active conversation messages: {}", agent.get_messages().len());

    Ok(())
}
```

---

## Dependencies

- **Internal Workspace Dependencies**:
  - [`scg2`](../scg2) — Smart Context Generation engine.
- **External Dependencies**:
  - `tokio` — Asynchronous runtime.
  - `reqwest` — HTTP client with JSON and HTTP/2 capabilities.
  - `serde`, `serde_json` — Data serialization and deserialization.
  - `futures` — Stream utilities.
  - `tracing` — Structured logging framework.
