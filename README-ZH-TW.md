<p align="center">
  <img src="public/icons/etc/icon.png" width="100" alt="Openvibe" />
</p>

<h1 align="center">Openvibe</h1>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe">GitHub</a> ·
  <a href="mailto:lolz@nihmadev.fun">lolz@nihmadev.fun</a> ·
  <a href="README.md">English</a> ·
  <a href="README-RU.md">Русский</a> ·
  <a href="README-ZH-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe/actions"><img src="https://img.shields.io/github/actions/workflow/status/nihmadev/OpenVibe/.github/workflows/build.yml?style=flat-square&logo=githubactions&label=build" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL%203.0-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-2021-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust 2021" />
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/SQLite-Bundled-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/MCP-Supported-8A2BE2?style=flat-square" alt="MCP Supported" />
</p>

---

Openvibe 是一個開源的智慧代理編碼環境，專為本地執行、高回應性和完整的程式碼控制而設計。基於模組化 Rust 工作區（11 個專用套件）以及輕量級 Tauri 2 搭配 React 18 前端，Openvibe 提供深度的程式碼庫理解、子代理任務執行，以及無縫的 Model Context Protocol (MCP) 整合，無需標準 Electron 應用的龐大體積。

---

## 架構與模組化套件

Openvibe 的核心功能分為 `crates/` 目錄中的 11 個專用 Rust 套件：

- **`crates/scg2`**：智慧上下文生成 2（SCG2）引擎。透過 Tree-Sitter（TypeScript、JavaScript、Rust、Python）在背景進行 AST 符號解析，建立圖依賴映射（`petgraph`），追蹤時間衰減指標，在編輯器懸停/游標遙測時提升符號相關性，同步編譯器診斷錯誤/警告，並為 LLM 提示詞格式化上下文片段。
- **`crates/agent`**：非同步 LLM 串流引擎（`reqwest` + `tokio`）。處理伺服器推送事件（SSE）解析、提示詞組裝、Token 歷史截斷、思考/推理串流提取、請求取消，以及多輪執行迴圈。
- **`crates/agent-tool`**：系統工具執行器（`read_file`、`write_file`、`edit_file`、`list_dir`、`run`、`search_codebase`、`agent` 子代理）與 Model Context Protocol 工具的動態橋接器（`mcp__<server>__<tool>`）。對 Shell 執行強制要求明確的確認提示。
- **`crates/mcp`**：Stdio 傳輸的 MCP 客戶端（JSON-RPC 2.0）。控制 MCP 伺服器程序生命週期、設定檔解析（`openvibe.toml`）、工具發現（`tools/list`）、執行分派（`tools/call`）、連線健康追蹤和程序恢復。
- **`crates/search`**：多執行緒程式碼庫搜尋，支援 `.gitignore` 解析、正規表達式和精確匹配、行標記化、語法高亮，以及透過 `fastembed` 實現的本地程式碼向量嵌入。
- **`crates/git`**：由 `git2`（libgit2 Rust 綁定）驅動的原生 Git 整合。管理工作區倉庫狀態、差異生成、暫存索引變更、提交執行和分支檢查。
- **`crates/db`**：SQLite 儲存層（`rusqlite` 以 WAL 模式打包）。管理工作區設定、供應商設定檔、模型設定、全域應用狀態，以及每個專案隔離的對話資料庫（`chats.db`）。
- **`crates/chats`**：聊天會話管理、訊息歷史持久化、上下文分支、訊息內容編輯和 SQLite 序列化。
- **`crates/terminal`**：原生終端程式運行器（`std::process::Command` 透過 Tauri IPC 事件將 stdio 直接串流至 xterm.js）。
- **`crates/editor`**：工作區文件狀態、分頁管理和作用中檔案編輯器同步。
- **`crates/config`**：設定檔序列化、預設選項和執行時設定儲存。

### 輔助服務

- **`api/`**：Go 代理伺服器（`main.go`、`proxy.go`、`updater.go`），處理 API 請求轉發、供應商連線預熱、逾時管理、健康檢查端點和自動更新驗證。

---

## 技術能力

### SCG2 上下文索引引擎

智慧上下文生成 2 在背景運行一個非同步工作程式，使用 500ms 防抖視窗匯總編輯器遙測批次。它提取語法樹、將模組匯入路徑解析為依賴圖、提升作用中游標符號的相關性排名、追蹤編譯器輸出中的診斷警告，並動態編譯結構化 Markdown 上下文區塊作為 LLM 系統提示詞。

### 代理迴圈與工具呼叫

- **執行引擎**：支援單步和多步代理執行週期。
- **內建工具**：`read_file`、`write_file`、`edit_file`、`list_dir`、`run`、`search_codebase` 和 `agent`（用於多步程式碼庫研究的子代理）。
- **命令安全性**：破壞性操作和終端操作需要使用者明確批准。
- **上下文邊界**：自動滑動視窗 Token 截斷以符合模型限制，結合 `@` 檔案參照和視覺模型的圖片附件支援。

### Model Context Protocol (MCP) 整合

- **Stdio 傳輸**：完整支援透過 stdin/stdout 使用 JSON-RPC 2.0 通訊的本地 MCP 伺服器。
- **自動註冊**：運行中的 MCP 伺服器提供的工具會動態註冊為 `mcp__<server>__<tool>`。
- **狀態監控**：標題列指示器反映即時 MCP 伺服器狀態（綠色：全部運行、黃色：部分運行、紅色：錯誤/已停止、灰色：未設定），附帶彈出式管理控制項。
- **設定檔**：透過 UI 設定或直接在工作區根目錄的 `openvibe.toml` 中宣告來進行配置。

### 程式碼編輯器與整合終端

- **Monaco Editor**：多分頁程式碼視圖、語法高亮、行號、未儲存檔案差異指示器、可自訂字體/大小，以及與聊天並排的分割窗格佈局。
- **xterm.js Terminal**：分頁式 PTY 會話、透過 fit 附加元件自動調整大小、Shell 偵測（`bash`、`zsh`、`pwsh`、`cmd`），以及透過 Rust 程序控制代碼的即時串流。

### 供應商與模型支援

- **33 個供應商預設**：Anthropic、OpenAI、Google Gemini、DeepSeek、Groq、OpenRouter、Ollama、Cerebras、Moonshot、Z.ai、Opencode Zen、GitHub Models、Together AI、Fireworks AI、Mistral AI、xAI (Grok)、Cohere、Alibaba (Qwen)、Azure OpenAI、AWS Bedrock、Hugging Face、Replicate、DeepInfra、Perplexity AI、Anyscale、Vercel AI Gateway、FalAI、Baseten、Hyperbolic、MiniMax、NVIDIA、SambaNova、SiliconCloud。
- **OpenAI 相容自訂端點**：連接自訂供應商基礎 URL、自訂請求標頭和 API 金鑰。
- **離線/本機執行**：原生相容於本地伺服器，包括 Ollama、LM Studio 和 vLLM。

### 自訂與本地化

- **38 種 UI 語言**：英文、俄文、德文、法文、西班牙文、中文（簡體/繁體）、日文、韓文、義大利文、葡萄牙文、阿拉伯文、印地文、土耳其文、越南文、波蘭文、烏克蘭文等。
- **18 種主題**：Ayu、Carbonfox、Cursor、Dark、Default、Everforest、Flexoki、GitHub、Gruvbox（Standard、Medium、Soft）、Kanagawa、Monokai、Nord、One Dark、Vercel、Vesper、Zenburn。
- **字型與圖示**：整合 Google Fonts 及豐富的檔案/資料夾圖示包。

---

## 開發與使用

### 前置條件

- **Node.js**：`>= 18`
- **Rust**：穩定工具鏈（`cargo`、`rustc`）
- **作業系統**：Linux、macOS 或 Windows

### 安裝

```bash
git clone https://github.com/nihmadev/OpenVibe.git
cd OpenVibe
npm install
```

### 開發伺服器

```bash
npm run dev
```

啟動 Vite 前端開發伺服器，並透過 `tauri dev` 執行桌面應用程式。

### 應用程式建置

```bash
npm run build
```

編譯 Web 前端（`npm run build:src`）並透過 Tauri 產生獨立的原生二進位檔案（`npm run build:tauri`）。

### 驗證與測試

```bash
npm run check    # 執行 TypeScript、ESLint 和 Prettier 驗證
npm test         # 透過 Vitest 執行單元和整合測試
```

---

## 授權條款

依據 GNU 通用公共授權條款 v3.0 或更新版本發佈。詳見 [LICENSE](LICENSE)。
