<p align="center">
  <img src="src-tauri/icons/icon.png" width="100" alt="Openvibe" />
</p>

<h1 align="center">Openvibe</h1>
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

> **⚠️ ПРЕДУПРЕЖДЕНИЕ:** Этот проект полностью создан искусственным интеллектом. Кодовая база, архитектура и документация были разработаны с помощью ИИ. Используйте на своё усмотрение.

---

Если ты пробовал **OpenCode Desktop**, то наверняка сталкивался с тем же: приложение постепенно съедает всю оперативку, процессор греется, иногда само перезапускается, а в худших случаях просто крашится и утягивает за собой другие программы. На GitHub полно issues, где RAM растёт до 20+ ГБ, пока система не падает.

**Openvibe — это тот же опыт, но без всей этой головной боли.** Собран на Tauri 2 + Rust. Лёгкий, не жрёт память, никаких внезапных релоадов, никаких runaway-циклов, которые валят систему.

---

## Стек и архитектура

- **Фронтенд:** React + TypeScript на Vite — горячая перезагрузка, быстрая итерация
- **Десктопная оболочка:** Tauri 2 — Rust под капотом, нативная производительность, маленький бинарник, без налогов Electron
- **Редактор кода:** Monaco Editor — тот же движок, что в VS Code, полная подсветка синтаксиса, автодополнение, вкладки, отслеживание несохранённых изменений
- **Терминал:** xterm.js подключён к реальным PTY-сессиям через node-pty на стороне Rust
- **База данных:** SQLite через rusqlite — разговоры, метаданные проектов, конфиги провайдеров, состояние приложения. Встроенная компиляция, без системных зависимостей
- **AI-агент:** Целиком на Rust. Прямые HTTP-запросы к API провайдеров через reqwest + tokio для асинхронной потоковой передачи. Парсинг SSE, повторные попытки, поддержка vision, управление лимитами токенов. Отслеживание файлов через крейт notify с антидребезгом
- **Прокси:** Небольшой Express-сервер в `api/` для Railway — перенаправляет запросы к провайдерам с настраиваемыми таймаутами
- **Языки:** 38 языков интерфейса
- **Темы:** 17 цветовых тем (Monokai, Nord, One Dark, Gruvbox, Kanagawa, Everforest и другие)
- **Провайдеры:** 11 встроенных + любые кастомные OpenAI-совместимые эндпоинты
- **Иконки:** 230 иконок типов файлов, 99 иконок папок
- **Офлайн:** Всё локально, работает без интернета с локальными моделями

---

## Что умеет Openvibe

- **AI-агент** читает, создаёт, редактирует файлы, запускает команды в терминале, ищет по коду текстом и регулярками (все сканирования на Rust, не на JS). Транслирует рассуждения в реальном времени, запрашивает подтверждение перед разрушительными операциями
- **Поддерживаемые провайдеры:** OpenAI (GPT-4o, o1, o3), Anthropic (Claude Sonnet, Opus, Haiku), Google (Gemini Pro, Flash), DeepSeek, Groq, Cerebras, OpenRouter, Ollama, LM Studio, Moonshot, Z.ai, Opencode Zen, любой кастомный OpenAI-совместимый URL
- **Редактор:** Интерфейс с вкладками, индикаторы несохранённых изменений, режим бок о бок с чатом для ручного редактирования во время работы агента
- **Терминал:** Несколько сессий с вкладками, автоопределение PowerShell (pwsh с запасным вариантом), настоящий PTY через node-pty, обработка изменения размера
- **Управление файлами:** Дерево проекта с иконками файлов/папок, контекстное меню правой кнопкой, drag-and-drop, автообновление при изменениях на диске через notify, нечёткий поиск для @-упоминаний
- **Чат и история:** Каждый разговор автосохраняется в SQLite, переключение сессий без потери контекста, перегенерация ответов, навигация по истории
- **Удобства:** @-упоминания файлов, перетаскивание изображений в чат, клавиатурные сокращения, поиск по проекту (Ctrl+K), масштабирование окна, звуки завершения, 38 языков интерфейса, 17 тем

---

## Быстрый старт

```bash
git clone https://github.com/nihmadev/OpenVibe.git
cd openvibe
npm install
```

### Разработка

```bash
node scripts/dev.js
```

Запускает Vite-сервер на порту 3000 и открывает окно Tauri.

### Сборка

```bash
npm run build
npm start
```

### Подключение модели

Запустите приложение. Нажмите на шестерёнку слева. Добавьте провайдера. Вставьте API-ключ. Выберите модель. Готово.

---

## Лицензия

Исходный код открыт для использования и модификации. Дизайн UI и визуальные активы являются собственностью. Подробнее в [LICENSE](LICENSE).
