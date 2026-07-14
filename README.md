<p align="center">
  <img src="public/icons/etc/icon.png" width="100" alt="Openvibe" />
</p>

<h1 align="center">Openvibe</h1>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe">GitHub</a> ·
  <a href="mailto:lolz@nihmadev.fun">lolz@nihmadev.fun</a> ·
  <a href="README-RU.md">Русская версия</a>
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

**Openvibe** is a high-performance, open-source agentic coding environment designed for local execution and maximum responsiveness. Built with a modular **Rust workspace (10 crates)** and a **Tauri 2 + React 18** frontend, Openvibe provides a lightweight alternative to resource-heavy Electron IDEs while delivering deep codebase understanding, AI agent automation, and Model Context Protocol (MCP) tool integration.

---

## Architecture & Modular Crates

The core functionality of Openvibe is divided into 10 specialized Rust crates inside `crates/`:

- **`crates/agent`**: Async LLM streaming engine (`reqwest` + `tokio`). Handles SSE parsing, prompt assembly, token history truncation, real-time reasoning/thinking stream extraction, cancellation, and execution loops.
- **`crates/agent-tool`**: System tool executor (`read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, `agent` subagent research) and dynamic bridge to MCP tools (`mcp__<server>__<tool>`). Enforces user confirmation for destructive shell commands.
- **`crates/mcp`**: Full Model Context Protocol (MCP) client over stdio transport (JSON-RPC 2.0). Manages MCP server process lifecycles, configuration (`openvibe.toml`), tool discovery (`tools/list`), tool calls (`tools/call`), status tracking, and auto-recovery.
- **`crates/search`**: Multithreaded codebase search with `.gitignore` parsing, regex and exact text matching, line tokenization, syntax highlighting, and vector search / code embedding functionality.
- **`crates/git`**: Native Git integration powered by `git2` (libgit2 Rust bindings). Handles repository status, diff calculation, staging, commit history, and branch detection.
- **`crates/db`**: SQLite database manager (`rusqlite` bundled in WAL mode). Persists projects, provider settings, model configuration, application state, and per-project conversation databases (`chats.db`).
- **`crates/chats`**: Chat session management, message history persistence, branching/editing, and SQLite serialization.
- **`crates/terminal`**: Native shell process runner (`std::process::Command` streaming stdio over Tauri events to frontend xterm.js).
- **`crates/editor`**: Workspace state and file editor synchronization.
- **`crates/config`**: Core application configuration management.

_Auxiliary services:_

- **`api/`**: Lightweight Go proxy server (`main.go`, `proxy.go`, `updater.go`) for request forwarding and release updater endpoints.

---

## Feature Overview

### AI Agent & Tool Execution

- **Multi-Step Execution**: The agent automatically inspects, searches, reads, creates, and modifies code files across multiple iterations.
- **Built-in Tools**: `read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, `agent` (subagent research).
- **Safety Prompting**: Requires explicit user approval before executing bash commands.
- **Context Management**: Auto-trims long conversation history to respect model context windows, supports @-mention file referencing, and image drag-and-drop for Vision models.

### Model Context Protocol (MCP) Integration

- **Stdio Transport**: Full support for local MCP servers via JSON-RPC 2.0 over stdio (e.g., `@modelcontextprotocol/server-filesystem`, `mcp-server-github`, custom binaries).
- **Auto-Discovery**: Server tools are dynamically registered into the AI agent (`mcp__<server>__<tool>`).
- **Titlebar Status Indicator**: Live status light (Green = All Enabled Running, Yellow = Partial, Red = Stopped/Error, Gray = Unconfigured) with a quick dropdown menu.
- **Configuration**: Managed visually in Settings or directly via `openvibe.toml` in the project root.

### Code Editor & Integrated Terminal

- **Monaco Editor**: Multi-tab code editing, syntax highlighting, line numbers, unsaved change indicators, custom font family/size, and split-view chat layout.
- **xterm.js Terminal**: Tabbed terminal sessions, auto-fit addon, shell detection (`bash`, `zsh`, `pwsh`, `cmd`), and real-time PTY process streaming.

### LLM Providers & Compatibility

- **33 Built-in Provider Templates**: Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, OpenRouter, Ollama, Cerebras, Moonshot, Z.ai, Opencode Zen, GitHub Models, Together AI, Fireworks AI, Mistral AI, xAI (Grok), Cohere, Alibaba (Qwen), Azure OpenAI, AWS Bedrock, Hugging Face, Replicate, DeepInfra, Perplexity AI, Anyscale, Vercel AI Gateway, FalAI, Baseten, Hyperbolic, MiniMax, NVIDIA, SambaNova, SiliconCloud.
- **Custom Endpoints**: Connect any OpenAI-compatible API base URL with custom headers, model lists, and parameters.
- **Local Models**: Works fully offline with local Ollama, LM Studio, or vLLM instances.

### Customization & Internationalization

- **38 UI Languages**: English, Russian, German, French, Spanish, Chinese (Simplified/Traditional), Japanese, Korean, Italian, Portuguese, Arabic, Hindi, Turkish, Vietnamese, Polish, Ukrainian, and more.
- **18 Color Themes**: Ayu, Carbonfox, Cursor, Dark, Default, Everforest, Flexoki, GitHub, Gruvbox (Standard, Medium, Soft), Kanagawa, Monokai, Nord, One Dark, Vercel, Vesper, Zenburn.
- **Rich File Icons**: 230 file type icons and 99 folder icons.

---

## Getting Started

### Prerequisites

- **Node.js**: `>= 18`
- **Rust**: Latest stable toolchain (`cargo`, `rustc`)
- **OS**: Linux, macOS, or Windows

### Installation

```bash
git clone https://github.com/nihmadev/OpenVibe.git
cd OpenVibe
npm install
```

### Running in Development

```bash
npm run dev
```

Starts the Vite dev server and launches the desktop application via `tauri dev`.

### Production Build

```bash
npm run build
```

Builds the frontend bundle (`npm run build:src`) and compiles the standalone Tauri binary (`npm run build:tauri`).

### Code Verification & Tests

```bash
npm run check    # Run TypeScript, ESLint, and Prettier checks
npm test         # Run unit & integration test suite (Vitest)
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
