// Mirror of preload's API shape, exposed on `window.vibe`.
// Keep in sync with electron/preload.ts.

export interface VibeConfig {
  model: string;
  baseUrl: string;
  cwd: string;
  autoApprove: boolean;
  apiKey: string;
  apiUrl?: string;
  providerId?: string;
}

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type VibeEvent =
  | { kind: "user"; text: string }
  | { kind: "assistant-start" }
  | { kind: "assistant-chunk"; text: string }
  | { kind: "assistant-end" }
  | { kind: "tool-call"; id: string; name: string; args: unknown }
  | { kind: "tool-chunk"; id: string; args: string }
  | { kind: "tool-result"; id: string; ok: boolean; text: string }
  | { kind: "tool-denied"; id: string; name: string }
  | { kind: "reasoning-chunk"; text: string }
  | { kind: "reasoning-end" }
  | { kind: "info"; text: string }
  | { kind: "stopped" }
  | { kind: "error"; text: string }
  | { kind: "done" };

export interface ConfirmPayload {
  id: string;
  toolName: string;
  args: unknown;
}

export interface FsEntry {
  name: string;
  path: string;
  isDir: boolean;
  size?: number;
}

export interface ChatSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export interface ChatRecord {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  // server-side ChatMessage shape (renamed via serde rename_all = "camelCase")
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentPart[] | null;
    name?: string;
    toolCallId?: string;
    toolCalls?: Array<{
      id: string;
      type: "function";
      function: { name: string; arguments: string };
    }>;
    reasoningContent?: string;
  }>;
}

export interface FileMatch {
  path: string;
  rel: string;
  name: string;
  isDir?: boolean;
}

export interface Project {
  id: string;
  path: string;
  name: string;
  color: string;
  addedAt: number;
  icon?: string | null;
  photo?: string | null;
}

export interface Provider {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  addedAt: number;
}

export interface VibeApi {
  init: () => Promise<{ ok: true; config: VibeConfig } | { ok: false; error: string }>;
  send: (text: string) => Promise<{ ok: boolean; error?: string }>;
  sendParts: (parts: ContentPart[], display?: string) => Promise<{ ok: boolean; error?: string }>;
  revertTo: (msgIndex: number) => Promise<void>;
  reset: () => Promise<void>;
  stop: () => Promise<void>;
  decide: (id: string, decision: "yes" | "no" | "always") => Promise<void>;
  pickWorkspace: () => Promise<string | null>;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  state: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
  };

  setModel: (model: string) => Promise<void>;
  setCwd: (cwd: string) => Promise<void>;
  setProvider: (apiKey: string, baseUrl: string, model: string, providerId?: string) => Promise<void>;
  providers: {
    list: () => Promise<Provider[]>;
    save: (provider: Provider) => Promise<void>;
    delete: (id: string) => Promise<void>;
  };

  models: {
    fetch: (
      baseUrl: string,
      apiKey: string,
      providerId?: string,
    ) => Promise<{ ok: true; models: { id: string; name: string }[] } | { ok: false; error: string }>;
    listDisabled: () => Promise<string[]>;
    toggleDisabled: (modelId: string) => Promise<boolean>;
    listEnabled: () => Promise<string[]>;
    toggleEnabled: (modelId: string) => Promise<boolean>;
  };
  chats: {
    list: () => Promise<ChatSummary[]>;
    listForProject: (projectId: string) => Promise<ChatSummary[]>;
    new: () => Promise<ChatSummary | null>;
    open: (id: string) => Promise<ChatRecord | null>;
    delete: (id: string) => Promise<void>;
    rename: (id: string, title: string) => Promise<void>;
  };
  projects: {
    list: () => Promise<Project[]>;
    active: () => Promise<Project | null>;
    add: () => Promise<Project | null>;
    setActive: (id: string) => Promise<Project | null>;
    remove: (id: string) => Promise<Project | null>;
    rename: (id: string, name: string) => Promise<void>;
    setColor: (id: string, color: string) => Promise<void>;
    setIcon: (id: string, icon: string | null) => Promise<void>;
    setPhoto: (id: string, photo: string | null) => Promise<void>;
    close: () => Promise<void>;
  };
  fs: {
    list: (dir: string) => Promise<{ ok: true; entries: FsEntry[] } | { ok: false; error: string }>;
    reveal: (path: string) => Promise<void>;
    read: (path: string) => Promise<{ ok: true; content: string } | { ok: false; error: string }>;
    readBinary: (path: string) => Promise<{ ok: true; data: string; size: number } | { ok: false; error: string }>;
    write: (path: string, content: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    rename: (from: string, to: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    delete: (path: string) => Promise<{ ok: true } | { ok: false; error: string }>;
    createFile: (dir: string, name: string) => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
    createDir: (dir: string, name: string) => Promise<{ ok: true; path: string } | { ok: false; error: string }>;
    find: (
      root: string,
      query: string,
      limit?: number,
    ) => Promise<{ ok: true; matches: FileMatch[] } | { ok: false; error: string }>;
    findAll: (
      root: string,
      query: string,
      limit?: number,
    ) => Promise<{ ok: true; matches: FileMatch[] } | { ok: false; error: string }>;
    projectInfo: (dir: string) => Promise<{ ok: true; name: string | null; version: string | null } | { ok: false }>;
  };
  clipboard: {
    writeText: (text: string) => void;
  };
  whisper: {
    transcribe: (
      audioBase64: string,
      mimeType: string,
    ) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
  };
  onEvent: (cb: (e: VibeEvent) => void) => () => void;
  onBusy: (cb: (busy: boolean) => void) => () => void;
  onConfirm: (cb: (p: ConfirmPayload) => void) => () => void;
  onChatsUpdated: (cb: () => void) => () => void;
  onFsChanged: (cb: () => void) => () => void;
  term: {
    start: (id: string, cols: number, rows: number) => Promise<boolean>;
    write: (id: string, data: string) => Promise<void>;
    resize: (id: string, cols: number, rows: number) => Promise<void>;
    kill: (id: string) => Promise<void>;
    onData: (cb: (p: { id: string; chunk: string }) => void) => () => void;
    onExit: (cb: (p: { id: string; code: number }) => void) => () => void;
  };
}

declare global {
  interface Window {
    vibe: VibeApi;
  }
}
