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

Openvibe — это агентное окружение разработки с открытым исходным кодом, предназначенное для локального запуска, мгновенного отклика и полного контроля над кодом. Приложение построено на базе модульного Rust-воркспейса из 11 специализированных крейтов и легкого фронтенда Tauri 2 с React 18, обеспечивая глубокий анализ репозиториев, автоматизацию задач через суб-агентов и интеграцию протокола Model Context Protocol (MCP) без ресурсов накладных расходов Electron.

---

## Архитектура и модульные крейты

Функциональное ядро Openvibe разделено на 11 специализированных Rust-крейтов в директории `crates/`:

- **`crates/scg2`**: Движок Smart Context Generation 2 (SCG2). Выполняет фоновый AST-анализ символов через Tree-Sitter (TypeScript, JavaScript, Rust, Python), строит граф зависимостей модулей (`petgraph`), учитывает показатели свежести обращаемых файлов, повышает приоритет символов под курсором и наведением мыши, синхронизирует ошибки и предупреждения компилятора, а также формирует релевантный контекст для промптов LLM.
- **`crates/agent`**: Асинхронный движок взаимодействия с LLM (`reqwest` + `tokio`). Отвечает за парсинг Server-Sent Events (SSE), сборку промптов, автоматическую обрезку истории по лимитам токенов, стриминг блока рассуждений (thinking), отмену запросов и циклы вызова инструментов.
- **`crates/agent-tool`**: Исполнитель системных инструментов (`read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase`, `agent` суб-агент) и динамический мост для инструментов Model Context Protocol (`mcp__<server>__<tool>`). Запрашивает подтверждение пользователя перед выполнением команд терминала.
- **`crates/mcp`**: Полноценный клиент MCP (JSON-RPC 2.0 over stdio). Управляет жизненным циклом процессов MCP-серверов, чтением конфигурации (`openvibe.toml`), автообнаружением инструментов (`tools/list`), вызовом методов (`tools/call`), отслеживанием состояния серверов и восстановлением соединений.
- **`crates/search`**: Многопоточный поиск по коду с учетом правил `.gitignore`, точным и regex-поиском, токенизацией строк, подсветкой синтаксиса и поддержкой локальных эмбеддингов кодовой базы через `fastembed`.
- **`crates/git`**: Нативная интеграция с Git на базе библиотеки `git2` (биндинги libgit2 для Rust). Поддерживает отслеживание статуса репозитория, вычисление diff, индексацию изменений (staging), коммиты и просмотр веток.
- **`crates/db`**: Слой хранения на базе SQLite (`rusqlite` в режиме WAL). Отвечает за сохранение проектов, профилей провайдеров, параметров моделей, общего состояния приложения и изолированных баз данных чатов (`chats.db`).
- **`crates/chats`**: Управление сессиями диалогов, сохранение истории сообщений, ветвление контекста, редактирование сообщений и сериализация SQLite.
- **`crates/terminal`**: Нативный запуск процессов терминала (`std::process::Command` с трансляцией потоков stdio в xterm.js через события Tauri IPC).
- **`crates/editor`**: Состояние документов рабочей области, управление вкладками и синхронизация активных файлов.
- **`crates/config`**: Управление конфигурационными файлами, настройки по умолчанию и рантайм-хранилище параметров.

### Вспомогательные сервисы

- **`api/`**: Прокси-сервер на Go (`main.go`, `proxy.go`, `updater.go`), обеспечивающий маршрутизацию запросов к провайдерам, управление таймаутами и прогревом соединений, эндпоинты проверки здоровья и механизм автообновления.

---

## Технические возможности

### Движок индексации контекста SCG2

Smart Context Generation 2 запускает асинхронный фоновый воркер, который агрегирует события редактора с использованием 500-миллисекундного окна дебаунсинга. Движок строит синтаксические деревья, сопоставляет пути импортов в граф зависимостей, повышает приоритет релевантности для символов под курсором, отслеживает сообщения об ошибках от компилятора и автоматически собирает структурированные блоки кода в синтаксисе markdown для системного промпта LLM.

### Исполнение агента и инструменты

- **Цикл выполнения**: Поддержка одношаговых и многошаговых циклов работы агента.
- **Встроенные инструменты**: `read_file`, `write_file`, `edit_file`, `list_dir`, `bash`, `search_codebase` и `agent` (суб-агент для сложных исследований кода).
- **Безопасность**: Запрос явного подтверждения у пользователя перед выполнением команд консоли и деструктивных операций.
- **Управление контекстом**: Автоматическая обрезка сообщений по скользящему окну токенов, поддержка `@` упоминаний файлов и прикрепления изображений для Vision-моделей.

### Интеграция Model Context Protocol (MCP)

- **Stdio-транспорт**: Поддержка локальных MCP-серверов, взаимодействующих через stdin/stdout по протоколу JSON-RPC 2.0.
- **Автоматическая регистрация**: Инструменты подключенных серверов автоматически становятся доступны в агенте с префиксом `mcp__<server>__<tool>`.
- **Мониторинг статуса**: Индикатор состояния серверов MCP в заголовке окна (Зеленый: Все работают, Желтый: Частично, Красный: Ошибка/Остановлен, Серый: Не настроено) с выпадающим меню управления.
- **Конфигурационный файл**: Настройка через интерфейс приложения или напрямую через `openvibe.toml` в корне рабочего пространства.

### Редактор кода и терминал

- **Monaco Editor**: Многовкладочный редактор кодовой базы, подсветка синтаксиса, номера строк, индикация несохраненных изменений, настраиваемые шрифты и размеры, режим работы рядом с чатом.
- **Терминал xterm.js**: Несколько сессий PTY, автоматическое подстраивание размера, определение системной оболочки (`bash`, `zsh`, `pwsh`, `cmd`) и трансляция потоков в реальном времени.

### Провайдеры и модели

- **33 встроенных шаблона**: Anthropic, OpenAI, Google Gemini, DeepSeek, Groq, OpenRouter, Ollama, Cerebras, Moonshot, Z.ai, Opencode Zen, GitHub Models, Together AI, Fireworks AI, Mistral AI, xAI (Grok), Cohere, Alibaba (Qwen), Azure OpenAI, AWS Bedrock, Hugging Face, Replicate, DeepInfra, Perplexity AI, Anyscale, Vercel AI Gateway, FalAI, Baseten, Hyperbolic, MiniMax, NVIDIA, SambaNova, SiliconCloud.
- **Кастомные эндпоинты**: Подключение любых OpenAI-совместимых провайдеров с произвольными URL, заголовками и ключами.
- **Офлайн-работа**: Совместимость с локальными серверами Ollama, LM Studio и vLLM.

### Кастомизация и локализация

- **38 языков интерфейса**: Русский, английский, немецкий, французский, испанский, китайский (упрощенный и традиционный), японский, корейский, итальянский, португальский, арабский, хинди, турецкий, вьетнамский, польский, украинский и другие.
- **18 цветовых тем**: Ayu, Carbonfox, Cursor, Dark, Default, Everforest, Flexoki, GitHub, Gruvbox (Standard, Medium, Soft), Kanagawa, Monokai, Nord, One Dark, Vercel, Vesper, Zenburn.
- **Типографика и иконки**: Встроенные шрифты Google Fonts и расширенные наборы иконок файлов и папок.

---

## Разработка и сборка

### Требования

- **Node.js**: `>= 18`
- **Rust**: Стабильная версия toolchain (`cargo`, `rustc`)
- **Операционная система**: Linux, macOS или Windows

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

Запускает Vite dev-сервер и приложение через `tauri dev`.

### Сборка приложения

```bash
npm run build
```

Выполняет компиляцию фронтенда (`npm run build:src`) и собирает нативный бинарный файл через Tauri (`npm run build:tauri`).

### Проверка кода и тесты

```bash
npm run check    # Проверка типов TypeScript, ESLint и Prettier
npm test         # Запуск модульных и интеграционных тестов (Vitest)
```

---

## Лицензия

Распространяется под лицензией MIT. Подробности в файле [LICENSE](LICENSE).
