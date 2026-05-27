<p align="center">
  <img src="src-tauri/icons/icon.png" width="100" alt="openvibe" />
</p>

<h1 align="center">openvibe</h1>

<p align="center">
  <b>An agentic coding environment that doesnt lock you in.</b>

<p align="center">
  <a href="https://openvibe-beta.vercel.app">website</a> ·
  <a href="https://github.com/mttscode/openvibe">github</a> ·
  <a href="mailto:mt-studio@bk.ru">mt-studio@bk.ru</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust" />
  <img src="https://img.shields.io/badge/Tauri-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Monaco-FFBE00?style=flat-square&logo=visualstudiocode&logoColor=white" alt="Monaco Editor" />
  <img src="https://img.shields.io/badge/xterm.js-000000?style=flat-square&logo=windowsterminal&logoColor=white" alt="xterm.js" />
  <img src="https://img.shields.io/badge/Tokio-FF4500?style=flat-square&logo=rust&logoColor=white" alt="Tokio" />
</p>

---

You know that feeling when every AI coding tool wants you to commit to their ecosystem, their subscription, their model, their way of doing things? openvibe was born from that exact frustration. It is a desktop application that brings together everything a developer needs &mdash; an AI assistant that actually writes code, a terminal that feels native, a code editor that doesnt get in your way, and a file manager that just works. But the real trick is this: you decide which model does the thinking.

No accounts to create. No premium tier dangling features you actually need. No telemetry phoning home about what you are building. You grab an API key from wherever you want &mdash; OpenAI, Anthropic, Google, DeepSeek, Groq, Cerebras, OpenRouter, or you fire up Ollama or LM Studio locally and pay nothing at all &mdash; and that is it. The application does not care who is behind the curtain. It just works.

---

## What It Feels Like

You open openvibe, point it at your project, pick a model, and suddenly you are not coding alone anymore. The AI agent reads your files. It writes new ones. It edits existing code with surgical precision. It runs commands in the terminal and watches the output. It searches your entire codebase with regular expressions. It sees images you drop into the chat if the model supports vision. Everything happens with transparency &mdash; the agent streams its reasoning in real time so you can see what it is thinking, and when it wants to do something destructive, it asks for your permission first.

You can @-mention any file in your project to attach it to a message. You can switch models mid-conversation with `/model`. You can open the Monaco editor side by side with the chat and tweak code while the agent is still working. You can drag and drop images straight into the prompt. The terminal has tabs &mdash; real PowerShell tabs, backed by actual PTY processes. The file tree shows your project with proper icons, supports right-click context menus, drag-and-drop, and it automatically refreshes when the agent modifies files on disk.

It feels like having a second pair of hands on the keyboard. Hands that belong to whichever model you trust most.

---

## The Stack

<p>
  <img src="https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/Tauri-FFC131?style=flat-square&logo=tauri&logoColor=black" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&logo=sqlite&logoColor=white" />
  <img src="https://img.shields.io/badge/Monaco%20Editor-FFBE00?style=flat-square&logo=visualstudiocode&logoColor=white" />
  <img src="https://img.shields.io/badge/xterm.js-000000?style=flat-square&logo=windowsterminal&logoColor=white" />
  <img src="https://img.shields.io/badge/notify-FF6600?style=flat-square&logo=files&logoColor=white" />
  <img src="https://img.shields.io/badge/Tokio-FF4500?style=flat-square&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/reqwest-000000?style=flat-square&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?style=flat-square&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/JetBrains%20Mono-000000?style=flat-square&logo=jetbrains&logoColor=white" />
  <img src="https://img.shields.io/badge/38%20languages-000000?style=flat-square&logo=googletranslate&logoColor=white" />
  <img src="https://img.shields.io/badge/17%20themes-000000?style=flat-square&logo=color&logoColor=white" />
</p>

The frontend is React with TypeScript, built on Vite &mdash; hot reload, fast iteration, no nonsense. The desktop shell is Tauri 2, which means it is Rust under the hood. Native performance, small binary, no Electron memory tax. The code editor is Monaco &mdash; the same engine that powers VS Code &mdash; with syntax highlighting, autocompletion, multiple open tabs, and unsaved change tracking. The terminal is xterm.js connected to real PTY sessions through node-pty on the Rust side. Conversations, project metadata, provider configurations, and application state are all stored in SQLite, managed through rusqlite with bundled compilation so there are no system dependencies to worry about.

The AI agent itself is written entirely in Rust. It makes direct HTTP requests to provider APIs using reqwest with tokio for async streaming. It parses SSE streams, handles retries, supports vision payloads, and manages token limits by trimming conversation history when things get long. File watching is handled by the notify crate with debouncing, so the file tree stays in sync whenever the agent or an external editor changes something on disk.

There is also a small Express proxy server in the api/ directory that can be deployed on Railway &mdash; it forwards requests to provider endpoints with configurable timeouts. Useful if you want to run the application in environments where direct API access is restricted.

38 interface languages. 17 color themes (Monokai, Nord, One Dark, Gruvbox, Kanagawa, Everforest, and more). 11 built-in model providers plus custom OpenAI-compatible endpoints for anything else. 230 file type icons. 99 folder icons. Everything is local-first and offline-capable if you use a local model.

---

## Features

**The AI Agent**
- Reads, writes, and edits files in your project
- Runs terminal commands and captures output
- Searches codebase by text and regular expressions &mdash; all file scanning runs in Rust, not JavaScript
- Streams its reasoning so you can follow along
- Maintains conversation context and summarizes aggressively when it gets too long
- Asks for confirmation before destructive operations

**Supported Providers**
- OpenAI &mdash; GPT-4o, o1, o3, everything
- Anthropic &mdash; Claude Sonnet, Opus, Haiku
- Google &mdash; Gemini Pro, Flash, with vision
- DeepSeek, Groq, Cerebras, OpenRouter
- Ollama and LM Studio &mdash; local, free, offline
- Moonshot, Z.ai, Opencode Zen
- Any custom URL that speaks OpenAI-compatible chat completions API

**The Editor**
- Tabbed interface with open file tracking
- Unsaved change indicators
- Full syntax highlighting and autocompletion via Monaco
- Side-by-side with chat for manual editing while the agent works

**The Terminal**
- Multiple tabbed sessions
- Automatic PowerShell detection (pwsh with fallback to Windows PowerShell)
- Real pseudo-terminal through node-pty
- Resize handling, proper escape sequences, the works

**File Management**
- Project tree with file-type and folder-type icons
- Right-click context menu with create, rename, delete, cut, paste
- Drag and drop support
- Auto-refresh when files change on disk via notify
- Fuzzy search for @-mention file attachment

**Chat and History**
- Every conversation is saved to SQLite automatically
- Switch between sessions without losing context
- Regenerate individual responses
- Navigate back to any point in the conversation history

**Quality of Life**
- Slash commands: /help, /clear, /reset, /cwd, /model, /test, /exit
- @-mention files to attach them to messages
- Drag images directly into the chat input
- Keyboard shortcuts for everything
- Project-wide search with Ctrl+K
- Window zoom with Ctrl+Plus and Ctrl+Minus
- Completion sounds
- 38 languages for the interface itself
- 17 themes so it looks the way you like

---

## Getting Started

```bash
git clone https://github.com/mttscode/openvibe.git
cd openvibe
npm install
```

### Development

```bash
node scripts/dev.js
```

This starts the Vite dev server on port 3000 and launches the Tauri window pointing at it.

### Building

```bash
npm run build
npm start
```

### Connecting a Model

Launch the application. Click the gear icon on the left sidebar. Add a provider. Paste your API key. Select a model. That is the whole process. There is no step five.

---

## Who This Is For

It is for developers who are tired of:

- monthly subscriptions that keep adding up
- tools that chain you to a single vendor
- telemetry and data collection baked into the editor
- browser-based coding tools that feel sluggish and disconnected from your actual filesystem

It is for developers who want to:

- control their own API keys and choose which model to use on any given day
- work offline with local models when the internet is spotty or when the work is sensitive
- Have an AI that acts like an engineer &mdash; reading code, writing code, running commands, searching files &mdash; not just a chatbot that generates text snippets

It is for developers who believe that the tools should adapt to the developer, not the other way around.

---

## License

The source code is open for use and modification. The UI design and visual assets are proprietary. See [LICENSE](LICENSE) for the specifics.

---

<p align="center">
  <small>Built by developers who got tired of being told which model to use</small>
  <br/>
  <a href="mailto:mt-studio@bk.ru">mt-studio@bk.ru</a>
</p>
