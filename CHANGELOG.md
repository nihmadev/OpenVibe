# Changelog

All notable changes to OpenVibe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.0] - 2026-07-15

### Added

- **Model Context Protocol (MCP) Integration**:
  - Full MCP client backend crate (`crates/mcp`) supporting JSON-RPC transport and local/stdio server management.
  - Dedicated MCP settings management panel (`McpSettingsPanel.tsx`) for adding, editing, enabling/disabling stdio servers, environment variables, and argument lists.
  - Live MCP status dropdown indicator in the titlebar showing active servers, tool counts, and connection states.
  - Interactive tool execution visualization in agent chat trajectory (`AgentToolView.tsx`) with live streaming of arguments, raw outputs, execution timing, and status badges.

- **Fast Search in Code Engine & UI**:
  - Integrated high-performance code content search panel (`SearchInCode.tsx`) featuring a dual view: Virtualized List View (powered by `@tanstack/react-virtual`) and Hierarchical Tree View.
  - Support for multi-threaded file walking (`jwalk`), `.gitignore` filter parsing, match caching, regex search, case-sensitive matching, whole-word matching, and include/exclude glob patterns.
  - Live syntax highlighting of search result snippets with instant click-to-navigate cursor jumping directly in Monaco Editor tabs.
  - Hotkey binding (`Ctrl+Shift+F`) and Command Palette search commands integration.

- **Smart Context Generation 2 (SCG2)**:
  - Integrated SCG2 intelligent code context engine (`crates/scg2`) with lightweight AST symbol extraction (structs, functions, classes, interfaces, traits) across Rust, TS, JS, Python, and Go.
  - Multi-factor context relevance scoring combining file recency decay, active tab focus, cursor position proximity, editor diagnostics, and uncommitted git delta changes.
  - Automated editor activity tracking (`scg2Tracker.ts`) streaming cursor and tab state via Tauri IPC (`scg2_push_event`) to continuously supply relevant context snippets for AI prompt assembly.

- **Git Workspace Crate (`crates/git`)**:
  - Dedicated backend module for git repository state inspection, branch name detection, unstaged/staged file status, diff computation, commit log parsing, and file modification recency analytics.

- **Workspace Custom Rules (.viberules)**:
  - Native loading and prompt injection of project-specific AI coding rules from `.viberules`, `AGENTS.md`, and `.cursorrules` located in the root of open workspace directories.

- **Gruvbox Color Themes**:
  - Added 3 Gruvbox theme variants: **Gruvbox Hard**, **Gruvbox Medium**, and **Gruvbox Soft**.

- **Custom AI Provider Extensions**:
  - Enhanced custom provider configuration with custom SVG icon selection, custom models API list URL, custom JSON headers override, and fine-grained parameter controls (temperature, top_p, penalty).

- **Editor Type Preloading Optimization**:
  - Extracted TypeScript declaration preloader to dedicated `crates/editor` crate, batching workspace `.d.ts` loading into a single fast IPC response.

### Fixed & Improved

- Fixed a critical infinite loop bug in search line syntax highlighter (`syntaxHighlightLine`) when processing empty queries.
- Fixed React hooks linting configuration and prettier format rules for CI quality checks.
- Resolved Rust Clippy strict compiler warnings (`unnecessary_sort_by`, `manual_ok_err`, `needless_borrow`, `manual_strip`, `collapsible_if`, `map_flatten`, `format_in_format_args`) across all 11 workspace crates.
- Configured workspace-level `clippy.toml` with `too-many-arguments-threshold = 12`.
- Refactored SVG icon rendering into a unified, modular icon library component system (`src/components/icons/`).
- Updated translations for MCP controls and code search across all 38 supported UI languages.

## [1.2.0] - 2026-07-11

### Added

- Initial public release
- AI agent with file read/write/edit, terminal execution, code search
- Monaco Editor with tabbed interface
- Real PTY terminal via xterm.js
- SQLite-based chat persistence and project management
- 38 UI languages, 17 themes, 230 file type icons
- 11 built-in AI providers + custom OpenAI-compatible endpoints
- Vector search (fastembed) and regex code search
- Drag-and-drop file management, @-mention file attachment
- Keyboard shortcuts, window zoom, completion sounds
- Cross-platform builds (Windows, macOS, Linux)
- Automated CI/CD pipeline with GitHub Actions
