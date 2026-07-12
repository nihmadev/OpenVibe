export interface CommandItem {
  id: string;
  labelKey: string;
  keywords: string[];
  shortcut?: string;
}

export const commands: CommandItem[] = [
  {
    id: "new-session",
    labelKey: "newSession",
    shortcut: "Ctrl+N",
    keywords: [
      "new session", "new chat",
      "новая сессия", "новый чат",
    ],
  },
  {
    id: "prev-session",
    labelKey: "prevSession",
    shortcut: "Ctrl+Shift+Tab",
    keywords: [
      "previous session", "prev session",
      "предыдущая сессия",
    ],
  },
  {
    id: "next-session",
    labelKey: "nextSession",
    shortcut: "Ctrl+Tab",
    keywords: [
      "next session",
      "следующая сессия",
    ],
  },
  {
    id: "toggle-terminal",
    labelKey: "toggleTerminal",
    shortcut: "Ctrl+`",
    keywords: [
      "toggle terminal",
      "terminal",
      "терминал",
      "переключить терминал",
    ],
  },
  {
    id: "close-terminal",
    labelKey: "closeTerminal",
    shortcut: "Ctrl+Shift+X",
    keywords: [
      "close terminal", "hide terminal",
      "закрыть терминал", "скрыть терминал",
    ],
  },
  {
    id: "new-terminal",
    labelKey: "newTerminal",
    shortcut: "Ctrl+Shift+T",
    keywords: [
      "new terminal",
      "новый терминал",
    ],
  },
  {
    id: "show-file-tree",
    labelKey: "showFileTree",
    keywords: [
      "show file tree", "open file tree",
      "показать дерево файлов", "открыть дерево файлов",
    ],
  },
  {
    id: "hide-file-tree",
    labelKey: "hideFileTree",
    keywords: [
      "hide file tree", "close file tree",
      "скрыть дерево файлов", "закрыть дерево файлов",
    ],
  },
  {
    id: "toggle-file-tree",
    labelKey: "toggleFileTree",
    shortcut: "Ctrl+Shift+E",
    keywords: [
      "toggle file tree", "file tree",
      "дерево файлов", "переключить дерево файлов",
    ],
  },
  {
    id: "toggle-chat-side",
    labelKey: "toggleSessions",
    shortcut: "Ctrl+B",
    keywords: [
      "toggle sidebar", "toggle sessions", "toggle chat side",
      "sidebar", "sessions",
      "сайдбар", "боковая панель", "сессии",
      "переключить сайдбар", "переключить сессии",
    ],
  },
  {
    id: "open-settings",
    labelKey: "openSettingsHotkey",
    shortcut: "Ctrl+,",
    keywords: [
      "open settings", "settings",
      "настройки", "открыть настройки",
    ],
  },
  {
    id: "close-project",
    labelKey: "closeProjectHotkey",
    shortcut: "Ctrl+Shift+W",
    keywords: [
      "close project",
      "закрыть проект",
    ],
  },
  {
    id: "new-project",
    labelKey: "newProjectHotkey",
    shortcut: "Ctrl+Shift+N",
    keywords: [
      "new project", "open project",
      "новый проект", "открыть проект",
    ],
  },
  {
    id: "close-file",
    labelKey: "closeFileHotkey",
    shortcut: "Ctrl+W",
    keywords: [
      "close file", "close tab",
      "закрыть файл", "закрыть вкладку",
    ],
  },
  {
    id: "clear-chat",
    labelKey: "clearChatHotkey",
    shortcut: "Ctrl+L",
    keywords: [
      "clear chat", "clear session",
      "очистить чат", "очистить сессию",
    ],
  },
];

export function filterCommands(query: string): CommandItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const scored = commands
    .map((cmd) => {
      let best = 0;
      for (const kw of cmd.keywords) {
        const k = kw.toLowerCase();
        if (k === q) best = Math.max(best, 100);
        else if (k.startsWith(q)) best = Math.max(best, 50);
        else if (k.includes(q)) best = Math.max(best, 10);
      }
      return { cmd, score: best };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.cmd);

  return scored;
}
