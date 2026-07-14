<p align="center">
  <img src="public/icons/etc/icon.png" width="100" alt="Openvibe" />
</p>

<h1 align="center">Openvibe</h1>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe">GitHub</a> ·
  <a href="mailto:lolz@nihmadev.fun">lolz@nihmadev.fun</a> ·
  <a href="README-RU.md">Russian Version</a>
</p>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe/actions"><img src="https://img.shields.io/github/actions/workflow/status/nihmadev/OpenVibe/.github/workflows/build.yml?style=flat-square&logo=githubactions&label=build" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-2021-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust 2021" />
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/SQLite-Bundled-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/MCP-Supported-8A2BE2?style=flat-square" alt="MCP Supported" />
</p>

---

Openvibe is an open-source agentic coding environment built for local execution, high responsiveness, and complete code control. Powered by a modular Rust workspace (11 specialized crates) and a lightweight Tauri 2 with React 18 frontend, Openvibe provides deep codebase understanding, subagent task execution, and seamless Model Context Protocol (MCP) integration without the heavy footprint of standard Electron applications.

---

## Architecture & Modular Crates

The core functionality of Openvibe is divided into 11 specialized Rust crates inside `crates/`:

- **`crates/scg2`**: Smart Context Generation 2 (SCG2) engine. Performs background AST symbol parsing via Tree-Sitter (TypeScript, JavaScript, Rust, Python), builds graph dependency maps (`petgraph`), tracks recency decay metrics, boosts symbol relevance on editor hover/cursor telemetry, synchronizes compiler diagnostic errors/warnings, and formats context snippets for LLM prompts.
- **`crates/agent`**: Async LLM streaming engine (`reqwest` + `tokio`). Handles Server-Sent Events (SSE) parsing, prompt assembly, token history truncation, thinking/reasoning stream extraction, request cancellation, and multi-turn execution loops.
- **`crates/agent-tool`**: System tool executor (`read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, `agent` subagent) and dynamic bridge for Model Context Protocol tools (`mcp__<server>__<tool>`). Enforces explicit confirmation prompts for shell execution.
- **`crates/mcp`**: Stdio transport MCP client (JSON-RPC 2.0). Controls MCP server process lifecycles, configuration parsing (`openvibe.toml`), tool discovery (`tools/list`), execution dispatch (`tools/call`), connection health tracking, and process recovery.
- **`crates/search`**: Multithreaded codebase search with `.gitignore` parsing, regex and exact matching, line tokenization, syntax highlighting, and local code vector embeddings via `fastembed`.
- **`crates/git`**: Native Git integration powered by `git2` (libgit2 Rust bindings). Manages workspace repository status, diff generation, staging index mutations, commit execution, and branch inspection.
- **`crates/db`**: SQLite storage layer (`rusqlite` bundled in WAL mode). Manages workspace configurations, provider profiles, model settings, global application state, and per-project isolated conversation databases (`chats.db`).
- **`crates/chats`**: Chat session management, message history persistence, context branching, message content editing, and SQLite serialization.
- **`crates/terminal`**: Native terminal process runner (`std::process::Command` streaming stdio over Tauri IPC events directly to xterm.js).
- **`crates/editor`**: Workspace document state, tab management, and active file editor synchronization.
- **`crates/config`**: Configuration file serialization, default options, and runtime settings store.

### Auxiliary Services

- **`api/`**: Go proxy server (`main.go`, `proxy.go`, `updater.go`) handling API request forwarding, provider connection warmup, timeout management, health endpoints, and auto-update verification.

---

## Technical Capabilities

### SCG2 Context Indexing Engine

Smart Context Generation 2 runs an asynchronous background worker that aggregates editor telemetry batches using a 500ms debouncing window. It extracts syntax trees, resolves module import paths into dependency graphs, boosts relevance ranks for active cursor symbols, tracks diagnostic warnings from compiler output, and dynamically compiles structured markdown context blocks for LLM system prompts.

### Agent Loop & Tool Calling

- **Execution Engine**: Supports single and multi-step agent execution cycles.
- **Built-in Tools**: `read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, and `agent` (subagent for multi-step codebase research).
- **Command Security**: Destructive actions and terminal operations require explicit user approval.
- **Context Boundaries**: Automatic sliding window token truncation to stay within model limits, combined with `@` file references and image attachment support for vision models.

### Model Context Protocol (MCP) Integration

- **Stdio Transport**: Full support for local MCP servers communicating over stdin/stdout via JSON-RPC 2.0.
- **Automatic Registration**: Tools provided by running MCP servers are registered dynamically as `mcp__<server>__<tool>`.
- **Status Monitoring**: Titlebar indicator reflecting real-time MCP server state (Green: All Running, Yellow: Partial, Red: Error/Stopped, Gray: Unconfigured) with popover management controls.
- **Configuration File**: Configured through the UI settings or declared directly in `openvibe.toml` inside the workspace root.

### Code Editor & Integrated Terminal

- **Monaco Editor**: Multi-tab code view, syntax highlighting, line numbers, unsaved file diff indicators, customizable fonts/sizes, and split-pane layout side-by-side with chat.
- **xterm.js Terminal**: Tabbed PTY sessions, automatic resizing via fit addon, shell detection (`bash`, `zsh`, `pwsh`, `cmd`), and real-time streaming over Rust process handles.

### Provider & Model Support

- **33 Provider Presets**: Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, OpenRouter, Ollama, Cerebras, Moonshot, Z.ai, Opencode Zen, GitHub Models, Together AI, Fireworks AI, Mistral AI, xAI (Grok), Cohere, Alibaba (Qwen), Azure OpenAI, AWS Bedrock, Hugging Face, Replicate, DeepInfra, Perplexity AI, Anyscale, Vercel AI Gateway, FalAI, Baseten, Hyperbolic, MiniMax, NVIDIA, SambaNova, SiliconCloud.
- **OpenAI-Compatible Custom Endpoints**: Connect custom provider base URLs, custom headers, and API keys.
- **Offline / Local Execution**: Native compatibility with local servers including Ollama, LM Studio, and vLLM.

### Customization & Localization

- **38 UI Languages**: English, Russian, German, French, Spanish, Chinese (Simplified/Traditional), Japanese, Korean, Italian, Portuguese, Arabic, Hindi, Turkish, Vietnamese, Polish, Ukrainian, and others.
- **18 Themes**: Ayu, Carbonfox, Cursor, Dark, Default, Everforest, Flexoki, GitHub, Gruvbox (Standard, Medium, Soft), Kanagawa, Monokai, Nord, One Dark, Vercel, Vesper, Zenburn.
- **Typography & Icons**: Integrated Google Fonts and extensive file/folder icon packs.

---

## Development & Usage

### Prerequisites

- **Node.js**: `>= 18`
- **Rust**: Stable toolchain (`cargo`, `rustc`)
- **Operating System**: Linux, macOS, or Windows

### Installation

```bash
git clone https://github.com/nihmadev/OpenVibe.git
cd OpenVibe
npm install
```

### Development Server

```bash
npm run dev
```

Launches the Vite frontend dev server and runs the desktop app via `tauri dev`.

### Application Build

```bash
npm run build
```

Compiles the web frontend (`npm run build:src`) and generates the standalone native binary via Tauri (`npm run build:tauri`).

### Verification & Testing

```bash
npm run check    # Run TypeScript, ESLint, and Prettier verifications
npm test         # Run unit and integration tests via Vitest
```

---

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.
