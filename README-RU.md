<p align="center">
  <img src="public/icons/etc/icon.png" width="100" alt="Openvibe" />
</p>

<h1 align="center">Openvibe</h1>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe">GitHub</a> ·
  <a href="mailto:lolz@nihmadev.fun">lolz@nihmadev.fun</a> ·
  <a href="README.md">English Version</a>
</p>

<p align="center">
  <a href="https://github.com/nihmadev/OpenVibe/actions"><img src="https://img.shields.io/github/actions/workflow/status/nihmadev/OpenVibe/.github/workflows/build.yml?style=flat-square&logo=githubactions&label=build" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="Лицензия" /></a>
  <img src="https://img.shields.io/badge/React-18-20232A?style=flat-square&logo=react&logoColor=61DAFB" alt="React 18" />
  <img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Rust-2021-000000?style=flat-square&logo=rust&logoColor=white" alt="Rust 2021" />
  <img src="https://img.shields.io/badge/Tauri-2.0-FFC131?style=flat-square&logo=tauri&logoColor=black" alt="Tauri 2" />
  <img src="https://img.shields.io/badge/Vite-6.0-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/SQLite-Bundled-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/MCP-Поддерживается-8A2BE2?style=flat-square" alt="MCP Поддерживается" />
</p>

---

**Openvibe** — это высокопроизводительное агентное окружение для разработки (AI IDE) с открытым исходным кодом, созданное для локальной работы и мгновенного отклика. Проект построен на основе модульного **Rust-воркспейса (10 крейтов)** и фронтенда **Tauri 2 + React 18**, что обеспечивает производительность нативного приложения без лишних расходов оперативной памяти.

---

## Архитектура и модульные крейты

Основная логика приложения разделена на 10 специализированных Rust-крейтов в директории `crates/`:

- **`crates/agent`**: Асинхронный движок взаимодействия с LLM (`reqwest` + `tokio`). Отвечает за парсинг SSE, сборку промптов, автоматическое сокращение контекста по лимитам токенов, стриминг рассуждений (`thinking`), отмену запросов и циклы вызова инструментов.
- **`crates/agent-tool`**: Исполнитель системных инструментов (`read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, `agent` суб-агент для исследований) и динамический мост к инструментам MCP (`mcp__<server>__<tool>`). Запрашивает подтверждение пользователя перед выполнением команд в терминале.
- **`crates/mcp`**: Полноценный клиент Model Context Protocol (MCP) через stdio-транспорт (JSON-RPC 2.0). Управляет жизненным циклом процессов MCP-серверов, парсит конфигурацию (`openvibe.toml`), отвечает за автообнаружение инструментов (`tools/list`), исполнение (`tools/call`), статус серверов и автовосстановление.
- **`crates/search`**: Многопоточный поиск по коду с учётом `.gitignore`, точным и regex-поиском, токенизацией строк, подсветкой синтаксиса и поддержкой векторного поиска (эмбеддингов).
- **`crates/git`**: Нативная интеграция с Git на базе библиотеки `git2` (биндинги libgit2 для Rust). Поддерживает статус репозитория, просмотр diff, индексацию изменений (staging), коммиты и ветки.
- **`crates/db`**: Менеджер SQLite БД (`rusqlite` в режиме WAL). Отвечает за хранение проектов, настроек провайдеров, параметров моделей, общего состояния приложения и изолированных баз данных чатов (`chats.db`).
- **`crates/chats`**: Управление сессиями чатов, сохранение истории сообщений, редактирование и ветвление диалогов.
- **`crates/terminal`**: Нативный запуск процессов терминала на стороне Rust (`std::process::Command` с трансляцией потоков stdio в xterm.js через события Tauri).
- **`crates/editor`**: Управление состоянием рабочего пространства и синхронизацией открытых файлов.
- **`crates/config`**: Главная конфигурация параметров приложения.

_Вспомогательные сервисы:_

- **`api/`**: Легковесный прокси-сервер на Go (`main.go`, `proxy.go`, `updater.go`) для проксирования запросов к провайдерам и проверки обновлений.

---

## Ключевые возможности

### AI-агент и инструменты

- **Многошаговое исполнение**: Агент самостоятельно анализирует проект, выполняет поиск, читает, создаёт и редактирует файлы кода за несколько итераций.
- **Встроенные инструменты**: `read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, `agent` (суб-агент).
- **Безопасность**: Запрос подтверждения у пользователя перед выполнением консольных команд (`bash`).
- **Управление контекстом**: Автоматическая обрезка старых сообщений при превышении лимита токенов, поддержка @-упоминаний файлов и drag-and-drop изображений для Vision-моделей.

### Интеграция Model Context Protocol (MCP)

- **Stdio-транспорт**: Полная поддержка MCP-серверов, работающих через stdin/stdout по протоколу JSON-RPC 2.0 (например, `@modelcontextprotocol/server-filesystem`, `mcp-server-github` и любые кастомные бинарники).
- **Автообнаружение**: Инструменты подключенных серверов автоматически регистрируются в AI-агенте под именами `mcp__<server>__<tool>`.
- **Индикатор в titlebar**: Цветовой индикатор статуса MCP в заголовке окна (Зелёный = Все включённые работают, Жёлтый = Частично, Красный = Ошибка/Остановлен, Серый = Не настроено) с выпадающим меню.
- **Управление конфигурацией**: Визуальный редактор в Настройках или прямое редактирование файла `openvibe.toml` в корне проекта.

### Редактор кода и терминал

- **Monaco Editor**: Многовкладочный редактор (движок VS Code), подсветка синтаксиса, номера строк, индикация несохранения, кастомизация шрифтов и масштаб, режим работы "боком к боку" с чатом.
- **Терминал xterm.js**: Несколько вкладок терминала, авто-подгонка размера, автоопределение оболочки (`bash`, `zsh`, `pwsh`, `cmd`) и нативный PTY-стриминг.

### Провайдеры ИИ и совместимость

- **33 встроенных шаблона провайдеров**: Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, OpenRouter, Ollama, Cerebras, Moonshot, Z.ai, Opencode Zen, GitHub Models, Together AI, Fireworks AI, Mistral AI, xAI (Grok), Cohere, Alibaba (Qwen), Azure OpenAI, AWS Bedrock, Hugging Face, Replicate, DeepInfra, Perplexity AI, Anyscale, Vercel AI Gateway, FalAI, Baseten, Hyperbolic, MiniMax, NVIDIA, SambaNova, SiliconCloud.
- **Кастомные эндпоинты**: Подключение любого OpenAI-совместимого API с произвольным URL, ключами, заголовками и параметрами.
- **Локальные модели**: Полная офлайн-работа с локальными серверами Ollama, LM Studio или vLLM.

### Кастомизация и локализация

- **38 языков интерфейса**: Русский, английский, немецкий, французский, испанский, китайский (упрощённый и традиционный), японский, корейский, итальянский, португальский, арабский, хинди, турецкий, вьетнамский, польский, украинский и другие.
- **18 цветовых тем**: Ayu, Carbonfox, Cursor, Dark, Default, Everforest, Flexoki, GitHub, Gruvbox (Standard, Medium, Soft), Kanagawa, Monokai, Nord, One Dark, Vercel, Vesper, Zenburn.
- **Богатые иконки**: 230 иконок типов файлов и 99 иконок папок.

---

## Быстрый старт

### Требования

- **Node.js**: `>= 18`
- **Rust**: Актуальная стабильная версия (`cargo`, `rustc`)
- **ОС**: Linux, macOS или Windows

### Установка

```bash
git clone https://github.com/nihmadev/OpenVibe.git
cd OpenVibe
npm install
```

### Запуск в режиме разработки

```bash
npm run dev
```

Запускает Vite dev-сервер и приложение в режиме `tauri dev`.

### Сборка приложения

```bash
npm run build
```

Собирает фронтенд (`npm run build:src`) и компилирует нативный бинарный файл Tauri (`npm run build:tauri`).

### Проверка кода и тесты

```bash
npm run check    # Проверка типов TypeScript, ESLint и Prettier
npm test         # Запуск юнитов и интеграционных тестов (Vitest)
```

---

## Лицензия

Распространяется под лицензией MIT. Подробности в файле [LICENSE](LICENSE).
