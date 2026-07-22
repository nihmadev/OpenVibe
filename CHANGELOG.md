# Changelog

All notable changes to OpenVibe will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.3.6](https://github.com/nihmadev/OpenVibe/compare/v1.3.5...v1.3.6) (2026-07-22)

This release adds reasoning effort control for AI models, a cross-platform clipboard utility with Wayland (`wl-copy`) support, live Markdown rendering in the prompt editor, security guards for external links and drag-and-drop events, and dark glassmorphism styling for context menus.

### Added

* **Reasoning Effort Control**
  * Added `ReasoningEffortSelector` control to the prompt input toolbar and Settings modal to set model reasoning intensity (`low`, `medium`, `high`, or disabled).
  * Added `setReasoningEffort` IPC bridge command and backend state persistence in Tauri.
  * Added `reasoning_effort` parameter handling to LLM request payloads in `crates/agent` and `src-tauri`.
  * Added translations for reasoning effort selection in 36 languages.

* **Cross-Platform Clipboard & Wayland Support**
  * Added `@tauri-apps/plugin-clipboard-manager` dependency and custom `clipboard_write_text` Tauri command with native `wl-copy` process invocation for Linux/Wayland.
  * Created `writeClipboard` utility (`src/utils/clipboard.ts`) with a multi-level fallback chain (Tauri plugin -> custom command -> `navigator.clipboard`).
  * Replaced direct `navigator.clipboard` calls in chat message actions, code blocks, streaming Markdown, commit tooltips, and chat history.

* **Prompt Input & Editor Enhancements**
  * Implemented live Markdown syntax rendering inside the prompt input with a setting to display dimmed ghost formatting characters (`**`, `` ` ``, `#`).
  * Added recent mention tracking (`recentMentions.ts`) and fuzzy filtering in `MentionPopup`.
  * Added `RollbackPill` component for user prompt rollback indicators.

* **Webview Security & System Integration**
  * Added `webviewGuards.ts` to intercept external link clicks and prevent default window drag-and-drop file navigation.
  * Added low-level stdio transport layer in `crates/mcp` for Model Context Protocol communication.
  * Added Niri window manager configuration files with Noctalia and Catppuccin themes.

* **UI & Component Polish**
  * Redesigned `ContextMenu` with dark-mode glassmorphism (`backdrop-filter`), hover highlights, and keyboard arrow navigation.
  * Added checkmark animations and status transition styling in `Todo` component.
  * Added token usage metric indicators and activity group animations in `AgentRun` and `AgentToolView`.

### Fixed

* Fixed Rust compiler and TypeScript build errors in CI (`agent.rs`, `llm.rs`, `lib.rs`, `utils.ts`).
* Updated Markdown sanitizer to allow `target` attributes on external links.
* Preserved key stability in `StreamingMarkdown` during stream updates.

## [1.3.5](https://github.com/nihmadev/OpenVibe/compare/v1.3.4...v1.3.5) (2026-07-19)

This release makes agent runs easier to follow and gives the agent safer, more useful project context, while polishing the editor, search, updater, and cross-platform experience.

### Added

* **Agent runs and persistent plans**
  * Added a persistent `todo` tool with task status, priorities, dependencies, acceptance criteria, evidence, and checkpoint data.
  * Grouped related reasoning and tool calls into readable activity sections with summaries, timing, progress, and dedicated error notices.
  * Added clearer rendering for agent reasoning, tool output, stopped runs, and failures.

* **Git-aware agent tools**
  * Added read-only tools for Git status, branches, refs, log, diff, show, blame, and merge-base queries.
  * Added scoped code search parameters so searches can be limited to the file, directory, crate, or package named by the user.
  * Added validation and output limits for Git arguments and command results.

* **Editor, LSP, and search improvements**
  * Added an inline Vibe panel and a Monaco LSP client for richer code assistance.
  * Improved Git diff viewing, editor/file navigation, search tree behavior, filtering, and keyboard interactions.
  * Added safer Markdown sanitization and structured file-tree rendering.

* **Desktop and UI foundations**
  * Refreshed loading, welcome, titlebar, terminal, and settings surfaces.
  * Added update-policy handling and version comparison for interactive and non-interactive desktop updates.
  * Added path, agent-run, todo, search, updater, and Markdown test coverage.

### Fixed

* Preserved valid assistant tool-call messages and bounded autonomous research so provider conversations remain valid and focused.
* Improved handling of malformed tool arguments, cancellation, SSE streaming, and agent/chat state transitions.
* Corrected cross-platform path handling and Git history/diff edge cases, including missing files and scoped paths.
* Prevented unsafe Markdown content and invalid update versions from reaching the UI or updater.
* Refreshed locale resources and kept untranslated strings from being replaced with incorrect values.

### Changed

* Bumped the application, desktop package, Tauri manifest, and release metadata to `1.3.5`.

## [1.3.4](https://github.com/nihmadev/OpenVibe/compare/v1.3.3...v1.3.4) (2026-07-19)

This release is focused on a more complete developer workspace: language-server support, richer Git inspection, a guided first-run experience, more dependable provider connectivity, and a substantial UI and localization refresh.

### Features

* **Language Server Protocol (LSP) foundation** ([e063faf](https://github.com/nihmadev/OpenVibe/commit/e063faf5a52dd923c648778c3e79efe3134e32b1), [96ce348](https://github.com/nihmadev/OpenVibe/commit/96ce348157050b17eb9ef5227133d132a25b6583))
  * Added a dedicated `crates/lsp` backend with server configuration, process lifecycle management, stdin/stdout/stderr pipes, environment handling, and binary resolution across Windows, macOS, and Linux.
  * Added language presets for Go, TypeScript/JavaScript, Lua, Rust, Python, HTML, CSS/SCSS/Less, JSON, Ruby, C/C++, Java, C#, and PHP.
  * Added Tauri commands to enumerate available servers and start a selected server from the UI.
  * Added a persistent runtime manager with download/extraction support and package installation for Node.js, Go, Lua, Python, Ruby, .NET, Rust Analyzer, Clangd, and JDTLS. Node, Go, Lua, and language-specific tools are provisioned into the app runtime directory when needed.
  * Added PATH composition and executable lookup so downloaded tools can be launched without requiring a globally configured developer environment.
  * Connected the agent tool executor to the shared LSP manager for future language-aware tool workflows ([23cfe54](https://github.com/nihmadev/OpenVibe/commit/23cfe545241717ae5b7e1ec0980c8d97d55f319f)).

* **Servers panel and LSP controls** ([9bf5a96](https://github.com/nihmadev/OpenVibe/commit/9bf5a96bed5010393cdd7b8b1036d0586e4a8db3), [c4af727](https://github.com/nihmadev/OpenVibe/commit/c4af727f89223b810b3046d897c65d8eb98d4d43))
  * Added a titlebar servers popover with separate MCP and LSP tabs.
  * Added an LSP server list with per-language enable/disable toggles, installing spinners, running/stopped/error indicators, and in-memory state synchronization.
  * Unified MCP and LSP status into the titlebar status badge; the badge now reflects installing, running, stopped, and error states.

* **Git diff and history workflow** ([49c0e02](https://github.com/nihmadev/OpenVibe/commit/49c0e02bf181d8171a0ab0caabdeb9773092284e), [a88fcff](https://github.com/nihmadev/OpenVibe/commit/a88fcffacd62e65df17a527a63ceba7785c4fea4), [829160a](https://github.com/nihmadev/OpenVibe/commit/829160a8d0847ee31dcc2b9511ba0712dbb25802))
  * Added a virtual `git-diff:` editor document backed by Monaco's side-by-side diff editor.
  * Git files can now be opened as diffs for working-tree changes (`HEAD` vs working tree), staged changes (`HEAD` vs index), and any commit (parent vs commit).
  * Added historical file-content loading from Git refs, including correct handling of new and deleted files and absolute paths.
  * Extended the Git panel with cleaner staged/unstaged sections, list/tree view switching, filtering, refresh and bulk stage/unstage actions, inline file diff opening, branch creation/checkout, and commit actions.
  * Refined the commit graph with swimlanes, branch/remote labels, expandable changed-file trees, richer commit selection details, and hover tooltips that remain inside the viewport.

* **Onboarding and loading experience** ([f6db1e2](https://github.com/nihmadev/OpenVibe/commit/f6db1e26c20a56d49108cbd578f9934d3f50895a), [f0cea27](https://github.com/nihmadev/OpenVibe/commit/f0cea27068dafbdd1dd547958b380aa4dba534de))
  * Replaced the minimal first-run screen with a multi-step welcome flow that introduces the workspace and lets users configure their name, language, theme, color scheme, animation style/speed, model behavior, terminal shell, file-tree rendering, sound, editor ligatures/font size, and interface font.
  * Reads the operating-system user name when available, persists onboarding/settings choices, and applies the interface font immediately.
  * Added reusable shimmer skeleton loaders for startup/file-tree and other loading states.
  * Added an error boundary so a broken welcome-screen preference or translation cannot prevent the application from opening.

* **Application shell, navigation, and shared UI** ([c4af727](https://github.com/nihmadev/OpenVibe/commit/c4af727f89223b810b3046d897c65d8eb98d4d43), [9d7af0c](https://github.com/nihmadev/OpenVibe/commit/9d7af0c83a0453b7f6c57d182dc81644f15badba), [bebc010](https://github.com/nihmadev/OpenVibe/commit/bebc0109f66f8b4c2cc9fc32136fb4fdf82f53c8), [716deff](https://github.com/nihmadev/OpenVibe/commit/716deff3638bca24bdf261dc1290b4084b8765ad))
  * Reworked the app layout and titlebar controls, including clearer active states, resizable chat/search/Git/terminal regions, and context menus for hiding or restoring titlebar actions.
  * Improved file-tree loading, active-file indicators, search popup spacing, terminal tab behavior, and shared select/settings controls.
  * Expanded the icon component set and refined Gruvbox theme palettes and Monaco diff colors.
  * Added utility coverage for path and UI helper behavior and tightened global scrollbar/style rules.

* **Agent reliability and chat persistence** ([829160a](https://github.com/nihmadev/OpenVibe/commit/829160a8d0847ee31dcc2b9511ba0712dbb25802))
  * User messages are persisted before generation starts, so a newly sent prompt is not lost if generation fails or the app is interrupted.
  * Tool failures are tagged as diagnostic hints for the model while the UI can suppress raw error noise; malformed tool-call JSON follows the same path.
  * Agent instructions now proactively use focused Markdown `tree` blocks for project/file structures and provide a consistent tree example.
  * Added Git-backed file snapshots at `WORKING`, `INDEX`, and commit refs for reliable historical content access.

* **Provider proxy and connectivity hardening** ([c80592c](https://github.com/nihmadev/OpenVibe/commit/c80592c99a880fe3015cff1aee987321c49b2928))
  * Added an allowlist for upstream provider hosts (including Azure OpenAI and AWS endpoints) before proxying custom base URLs.
  * Corrected Anthropic authentication/version headers and Google header handling for chat and model-list requests.
  * Increased reusable connection pool capacity, made warm-provider tracking read/write safe, and pooled SSE buffers to reduce allocation overhead.
  * Added a setting-aware direct/proxy path so users can disable the regional proxy for agent and model requests.

* **Localization and project maintenance** ([3d1428d](https://github.com/nihmadev/OpenVibe/commit/3d1428db505360639cf731bc672f6351ff508816), [8a70e0a](https://github.com/nihmadev/OpenVibe/commit/8a70e0ac20753e5c9bff401ae034fe4fea2a728b), [16549c3](https://github.com/nihmadev/OpenVibe/commit/16549c3321ee8b269296a800256bec2cc04fa160))
  * Updated onboarding, LSP, servers, Git, loading, and shared-control strings across the supported locale set, including refreshed Chinese (Simplified/Traditional) and Vietnamese resources.
  * Added missing locale resources/keys and normalized translation files so new UI surfaces remain translatable.
  * Excluded translation virtualenv artifacts from linting and removed obsolete translation helper scripts.

### Fixed

* Welcome-screen failures are now isolated by an error boundary; Python virtual environments are ignored by the relevant lint/file workflows.
* Proxy routing no longer forwards arbitrary hosts and handles provider-specific authentication consistently.
* New/deleted files in Git diffs no longer fail merely because one side of the comparison has no blob.
* Tool execution errors and invalid JSON arguments are reported consistently to both the agent and the UI.

### Changed

* Bumped the application, desktop package, Tauri manifest, and release metadata to `1.3.4` ([2421541](https://github.com/nihmadev/OpenVibe/commit/242154129731fd4dbe4dda44f084794937201b5d)).

## [1.3.3](https://github.com/nihmadev/OpenVibe/compare/v1.3.2...v1.3.3) (2026-07-17)

This release introduced the new Git source-control experience and reorganized the frontend around reusable components and a typed Tauri bridge.

### Added

* **Git source control panel** ([ea99068](https://github.com/nihmadev/OpenVibe/commit/ea9906821631071137cfdd9f3260365d768e2c56), [84cca57](https://github.com/nihmadev/OpenVibe/commit/84cca57bad350bc30027e3dd08bea274fbabb72c), [9da4b86](https://github.com/nihmadev/OpenVibe/commit/9da4b86f887e0a0f819d88304e38d00f01b56e82), [b56375c](https://github.com/nihmadev/OpenVibe/commit/b56375cdc54aec322d07a897b25c0742c2b0987a))
  * Added a Git panel with staged/unstaged file views, commit actions, branch management, GitHub/Gravatar avatars, and an interactive commit graph with lane rendering.

* **Frontend bridge and shared utilities** ([8f22fbc](https://github.com/nihmadev/OpenVibe/commit/8f22fbc9243d08233ac6b2bfffd63d902bb50f28), [a88759a](https://github.com/nihmadev/OpenVibe/commit/a88759adefd569e3f11d182dd9b98a296f8211f0))
  * Added typed bridge modules for Tauri APIs and shared path, string, language, and syntax utilities.

### Changed

* Split Search in Code into focused hooks, components, and utilities ([b0eb3e5](https://github.com/nihmadev/OpenVibe/commit/b0eb3e51118a087b63a545b5894d9af004bf9ed1)).
* Reorganized AgentChat, PromptInput, SessionList, and Icons into modular component directories and removed deprecated directories ([fc73a47](https://github.com/nihmadev/OpenVibe/commit/fc73a470f9cc076e7539ae31c65c035e0d061f1e), [692b8f2](https://github.com/nihmadev/OpenVibe/commit/692b8f21e76f26cdfb7600df8e10aad889cbc623)).
* Improved agent system instructions with thought tags and a zero-text tool-call protocol ([f3f57f0](https://github.com/nihmadev/OpenVibe/commit/f3f57f022272fe7ecf590bfbbc322dcb46ac30cb)).
* Detached CLI child processes so the launcher can exit immediately ([d61384d](https://github.com/nihmadev/OpenVibe/commit/d61384def8c808088495b7a841f39595c854edbc)).
* Refreshed build/CI configuration, dependencies, and repository hooks ([1805efc](https://github.com/nihmadev/OpenVibe/commit/1805efc1b593a0d33ba03d628968aae5648a01f5), [e527e80](https://github.com/nihmadev/OpenVibe/commit/e527e802370b4ecabbe1590950f46c5e5ce8664a)).

### Fixed

* Updated the desktop updater to use native `fetch` and improved architecture matching for downloads.

## [1.3.2](https://github.com/nihmadev/OpenVibe/compare/v1.3.1...v1.3.2) (2026-07-16)

### Changed

* Replaced Linux AppImage artifacts with `tar.gz` and RPM packages to avoid WebKitGTK/EGL issues ([b620d5e](https://github.com/nihmadev/OpenVibe/commit/b620d5e134f4a21048325aa848e2607f5efd8616)).
* Updated package and Cargo metadata to use the `nihmadev` author identity instead of `mt-studio` ([08d8846](https://github.com/nihmadev/OpenVibe/commit/08d8846fad2decaee12c69979e76ce14618d584c)).

## [1.3.1](https://github.com/nihmadev/OpenVibe/compare/v1.3.0...v1.3.1) (2026-07-15)

This maintenance release improved startup performance, terminal reliability, editor assistance, provider configuration, and release infrastructure.

### Added

* **AI Fix-it in the editor** — added an action to apply agent-generated fixes from Monaco hover diagnostics ([3d22cb6](https://github.com/nihmadev/OpenVibe/commit/3d22cb6f75a471944aea7bb30f02d7e194697e71)).
* Added portable PTY session handling for the terminal ([f5f81b0](https://github.com/nihmadev/OpenVibe/commit/f5f81b0406b938171dd2972687f20d3a43f856c9)).

### Changed

* Optimized application startup with parallel preloading, background warm-up, and agent pre-initialization when credentials are available ([ef5bef6](https://github.com/nihmadev/OpenVibe/commit/ef5bef6900434c28221f810074d4a236d828c3fe), [fb0663b](https://github.com/nihmadev/OpenVibe/commit/fb0663b36b925766d0347316c3a51c842e408da5)).
* Improved MCP `npx` startup with an explicit starting state and optimized initialization ([2cb945b](https://github.com/nihmadev/OpenVibe/commit/2cb945bc7eab292844986a42dc29c4e565aa7c39)).
* Connected the provider popup to custom provider settings and disabled the Godot MCP server by default ([8200e6e](https://github.com/nihmadev/OpenVibe/commit/8200e6e836e0fa7fb902df5ffcb4b6ab07c5d908)).
* Improved chat database error handling and transaction management ([f1f024e](https://github.com/nihmadev/OpenVibe/commit/f1f024e789dfaad8f52dd75b0b7a5a30cc38030e)).

### Fixed

* Fixed Linux WebKitGTK 4.1/EGL packaging issues and editor panel resizing constraints ([be4a8bc](https://github.com/nihmadev/OpenVibe/commit/be4a8bc1f6fafc778cd508e6eed34b3c39a61a2d), [50133fb](https://github.com/nihmadev/OpenVibe/commit/50133fb783bfe9218b8eaec063809d6c5a398913)).
* Refined release workflows, tag matching, artifact handling, Unicode truncation, and CI validation ([8972acc](https://github.com/nihmadev/OpenVibe/commit/8972acce5afd146a58ee35bebf574213bb35bd35), [62c6744](https://github.com/nihmadev/OpenVibe/commit/62c6744e1a62f84b47bbac4a444d16275b7473f5)).

## [1.4.0](https://github.com/nihmadev/OpenVibe/compare/openvibe-v1.3.0...openvibe-v1.4.0) (2026-07-15)

### Features

* add command palette to search popup ([96b374f](https://github.com/nihmadev/OpenVibe/commit/96b374f3721d03b5ecd466429271cdd806fa9319))
* add content search engine with caching, filtering and syntax highlighting ([88d7f6a](https://github.com/nihmadev/OpenVibe/commit/88d7f6a647cf6858e485ccb94f9e8f28dd721380))
* add editor navigation from search results ([31e10e6](https://github.com/nihmadev/OpenVibe/commit/31e10e68a73c76ea2147dac84e91928abdbbde66))
* add Gruvbox Hard, Medium and Soft theme variants ([8531003](https://github.com/nihmadev/OpenVibe/commit/85310039d974bf805bfd42996c5ec161f813603e))
* add keyboard navigation and shortcut bindings to search-in-code panel ([be2d72f](https://github.com/nihmadev/OpenVibe/commit/be2d72fc648a2942a7c91f4ad7e6018fd4b9879e))
* add SearchInCode panel component with virtualized list and tree view ([7cf0446](https://github.com/nihmadev/OpenVibe/commit/7cf044640c9c2eb36823828ae26e1ae5ed39cf04))
* add Tauri IPC commands for content search ([96dfce5](https://github.com/nihmadev/OpenVibe/commit/96dfce5d6513568546819d90b49f6f802f94d529))
* add TypeScript types and tauri bridge for search APIs ([cfb8df9](https://github.com/nihmadev/OpenVibe/commit/cfb8df97169f1db619e788ae10d106dcc08f9fec))
* add user message index for accurate rollback ([140c132](https://github.com/nihmadev/OpenVibe/commit/140c132eff3a68ad96e93d3103c79048642a6d55))
* **agent:** Support project rules loading (.viberules, AGENTS.md, .cursorrules) ([9bba445](https://github.com/nihmadev/OpenVibe/commit/9bba445c2ed5378c10a748a8560d903bbfd4871d))
* **chat:** update chat history UI, streaming markdown, prompt input, and agent tool visualization ([efc6ab5](https://github.com/nihmadev/OpenVibe/commit/efc6ab5a78532b17a87e3370693d0cbcef4b5885))
* **editor:** implement ai fix-it action in monaco editor hover ([a743bbb](https://github.com/nihmadev/OpenVibe/commit/a743bbbc39ac48341b25cbbabe87e106f73e80f2))
* **editor:** improve search, editor components, settings panels, hooks, and Tauri bridge bindings ([b13b668](https://github.com/nihmadev/OpenVibe/commit/b13b6680e508ea7416bfd64cebda1ae8e22fcad5))
* extend custom provider with icon, models URL, headers and parameters ([ea5e288](https://github.com/nihmadev/OpenVibe/commit/ea5e2882a6fcefa540c9a30fb68eecfce0c82c9e))
* **git:** add git workspace crate and integration commands ([39dc55a](https://github.com/nihmadev/OpenVibe/commit/39dc55aa61bf58056c6bfb87eff0b5638274945a))
* **git:** Add history tracking module to git crate ([cdaefb6](https://github.com/nihmadev/OpenVibe/commit/cdaefb62c0f630f7eabe768e20748a052d873276))
* group hotkeys into categories with section headers ([4fddc9f](https://github.com/nihmadev/OpenVibe/commit/4fddc9f7c99618f6df1877be62f5862f30932902))
* integrate search-in-code panel into app layout and titlebar ([d02f395](https://github.com/nihmadev/OpenVibe/commit/d02f3957a65b146c1cc53e83b4d721a394c918cd))
* **mcp:** add titlebar indicator, settings panel and tool execution view ([359d749](https://github.com/nihmadev/OpenVibe/commit/359d749e0e16e8e3b6798fa8c94233075630070f))
* **mcp:** implement mcp server management backend and json-rpc transport ([e722173](https://github.com/nihmadev/OpenVibe/commit/e7221739dbca896ab124303c4a8c86dee81c3c19))
* **mcp:** Redesign MCP settings UI and update Tauri bridge ([1431329](https://github.com/nihmadev/OpenVibe/commit/14313294b1e6559d92050e3340a304d7bbdaae83))
* respect .gitignore rules in file and content search ([007f774](https://github.com/nihmadev/OpenVibe/commit/007f774d3152f6394687a2e0b6385c4f8d3bb4a4))
* **scg2:** Add Semantic Code Graph 2 backend engine ([b4bfeda](https://github.com/nihmadev/OpenVibe/commit/b4bfeda6200705bc7e6c5f4a659be330dec3964e))
* **scg2:** Integrate SCG2 with Tauri IPC and Editor tracker ([4cda0d0](https://github.com/nihmadev/OpenVibe/commit/4cda0d0d6eb53e8d3879e187cdebea6111b293d7))
* **settings:** add Design tab with animation style picker and preview ([5a2a870](https://github.com/nihmadev/OpenVibe/commit/5a2a870153eedb5c4984c7a3e36b706757e984ed))
* **ui:** redesign core layout, titlebar controls, navigation icons, and file tree node ([fa0803a](https://github.com/nihmadev/OpenVibe/commit/fa0803a37115d9e6aeaa28294d09bd33525477bf))


### Bug Fixes

* .md format pretty errors ([6df5225](https://github.com/nihmadev/OpenVibe/commit/6df5225d0ca0c9186a40f031ec565fef73717cab))
* add timeout to sse stream chunk reading to prevent hang ([22bce9a](https://github.com/nihmadev/OpenVibe/commit/22bce9aa46541c39ea16c20848d35e21b05d2c1a))
* cargo clippy error ([4dd2899](https://github.com/nihmadev/OpenVibe/commit/4dd2899919861ccb0fea603a2fb356ac12e6a0f5))
* **ci:** add linux system deps to quality job in workflow ([e34602d](https://github.com/nihmadev/OpenVibe/commit/e34602da37530e526cf2bebe504f14c21481f570))
* **ci:** enable dev branch workflow triggers and add npm token validation ([62c6744](https://github.com/nihmadev/OpenVibe/commit/62c6744e1a62f84b47bbac4a444d16275b7473f5))
* **ci:** update artifact glob patterns for macOS app directory and target bundle paths ([a75e7e6](https://github.com/nihmadev/OpenVibe/commit/a75e7e678fb877d4cbb4b86f535651d7f9deb401))
* clamp settings select dropdown within container bounds ([fc14849](https://github.com/nihmadev/OpenVibe/commit/fc14849397b6d4cec9d16e08dc1c70ab3408ca79))
* connect provider pop-up use custom settings ([de5e4fb](https://github.com/nihmadev/OpenVibe/commit/de5e4fb94874e218e09864bbfc632bd83242a2ae))
* EGL WebKitGTK 4.1 linux error ([0ec5a7f](https://github.com/nihmadev/OpenVibe/commit/0ec5a7fd78e18e51879d512aa7d7fbb67e79f141))
* error complils ([6a979f6](https://github.com/nihmadev/OpenVibe/commit/6a979f6b65867ee9f5f0510178d2f3d92130e5c8))
* fix animation in SessionList text unwrap, and added support animations to SearchinCode component ([f4da11b](https://github.com/nihmadev/OpenVibe/commit/f4da11bbeff21af0c440fd6b4182ec9781a4ab5c))
* fix types errors and add sscache to CI/CD ([bff40f0](https://github.com/nihmadev/OpenVibe/commit/bff40f031af60e7f296af61d1e03edde6e4e3e00))
* improve file tree active state indicators ([89cf2a2](https://github.com/nihmadev/OpenVibe/commit/89cf2a24230f37fc3202fd43609c940d8e01083f))
* no files found in public ([040f994](https://github.com/nihmadev/OpenVibe/commit/040f994d003c665f222f24bc2717043f6128cced))
* PreLinter zeroid a file ([b2120e3](https://github.com/nihmadev/OpenVibe/commit/b2120e323fa07c98375d5cb07637b6d2c3572c69))
* resolve Monaco editor import resolution for .js → .ts/.tsx and preload on every file switch ([4b0de1a](https://github.com/nihmadev/OpenVibe/commit/4b0de1a3b7ddfe0a1f6478e5f8d76d69e5174ee3))
* restore missing gear icon svg path in settings ([4dfbca3](https://github.com/nihmadev/OpenVibe/commit/4dfbca34a81e91b25de01f2f87c0c52db11545f6))
* sscache job ([885e25e](https://github.com/nihmadev/OpenVibe/commit/885e25eee9ae3e3ad413749dc713fa912cf77366))
* **terminal:** integrate portable-pty for proper session handling and update UI ([4ae3a6f](https://github.com/nihmadev/OpenVibe/commit/4ae3a6f684bd2845f015c992e2c6fd7afb1ce530))
* **ui:** adjust code block height, padding, copy trimming and context menu checkboxes ([0d82c52](https://github.com/nihmadev/OpenVibe/commit/0d82c529ca59eb36736ee76f340c3f016b16c4b4))
* **ui:** adjust editor panel resizing constraints ([9dfeb0c](https://github.com/nihmadev/OpenVibe/commit/9dfeb0cc1b4ea8073af998a8ce8440967d4c5bfa))
* update monaco typescript paths after deps upgrade ([3224ff0](https://github.com/nihmadev/OpenVibe/commit/3224ff0c82160f6ac26c93df8a20ab89dc0d8e5b))
* **vite:** convert manualChunks object to function for Rolldown compatibility ([7d94978](https://github.com/nihmadev/OpenVibe/commit/7d9497866b4a43c1b2a103d69613cf19814f3de4))


### Performance Improvements

* **agent:** pre-initialize agent instance on app startup when credentials are valid ([fb0663b](https://github.com/nihmadev/OpenVibe/commit/fb0663b36b925766d0347316c3a51c842e408da5))
* **app:** optimize initialization with parallel preloading and background warm-up ([ef5bef6](https://github.com/nihmadev/OpenVibe/commit/ef5bef6900434c28221f810074d4a236d828c3fe))
* **mcp:** optimize npx startup time and add starting status state ([69b7f58](https://github.com/nihmadev/OpenVibe/commit/69b7f586514442cc63fe9242059e03323220ef11))

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
