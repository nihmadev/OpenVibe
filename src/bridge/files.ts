import { invoke } from "@tauri-apps/api/core";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { wrap } from "./helpers.js";

export const filesBridge = {
  pickWorkspace: async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const folder = await open({ directory: true, multiple: false });
      return folder || null;
    } catch {
      return null;
    }
  },

  window: {
    minimize: () => invoke("window_minimize"),
    maximize: () => invoke("window_maximize"),
    close: () => invoke("window_close"),
    setSize: (width: number, height: number) => invoke("window_set_size", { width, height }),
    setFullscreen: (fullscreen: boolean) => invoke("window_set_fullscreen", { fullscreen }),
  },

  state: {
    get: (key: string) => invoke("state_get", { key }),
    set: (key: string, value: string) => invoke("state_set", { key, value }),
    getSystemUser: () => invoke<string>("get_system_user"),
  },

  editor: {
    preloadTypes: (cwd: string) =>
      wrap(
        () =>
          invoke<{
            types: Array<{ path: string; content: string }>;
            packages: Array<{ name: string; typePath: string; content: string }>;
          }>("editor_preload_types", { cwd }),
        (result) => ({ types: result.types, packages: result.packages }),
      ),
  },

  fs: {
    list: (dir: string) =>
      wrap(
        () => invoke("fs_list", { dir }),
        (entries) => ({ entries }),
      ),
    reveal: async (path: string) => {
      try {
        await shellOpen(path);
      } catch {
        /* ignore */
      }
    },
    read: (path: string) =>
      wrap(
        () => invoke<string>("fs_read", { path }),
        (content) => ({ content }),
      ),
    readBinary: (path: string) => wrap(() => invoke<{ data: string; size: number }>("fs_read_binary", { path })),
    write: (path: string, content: string) => wrap(() => invoke("fs_write", { path, content })),
    rename: (from: string, to: string) => wrap(() => invoke("fs_rename", { from, to })),
    delete: (filePath: string) => wrap(() => invoke("fs_delete", { path: filePath })),
    createFile: (dir: string, name: string) =>
      wrap(
        () => invoke<string>("fs_create_file", { dir, name }),
        (path) => ({ path }),
      ),
    createDir: (dir: string, name: string) =>
      wrap(
        () => invoke<string>("fs_create_dir", { dir, name }),
        (path) => ({ path }),
      ),
    find: (root: string, query: string, limit?: number) =>
      wrap(
        () => invoke("fs_find", { root, query, limit }),
        (matches) => ({ matches }),
      ),
    findAll: (root: string, query: string, limit?: number) =>
      wrap(
        () => invoke("fs_find_all", { root, query, limit }),
        (matches) => ({ matches }),
      ),
    searchContent: (
      root: string,
      query: string,
      maxResults?: number,
      matchCase?: boolean,
      matchWholeWord?: boolean,
      useRegex?: boolean,
      include?: string,
      exclude?: string,
    ) =>
      wrap(
        () =>
          invoke("fs_search_content", {
            root,
            query,
            maxResults,
            matchCase,
            matchWholeWord,
            useRegex,
            include,
            exclude,
          }),
        (matches) => ({ matches }),
      ),
    searchContentFilter: (
      root: string,
      query: string,
      matchCase: boolean,
      matchWholeWord: boolean,
      useRegex: boolean,
      include: string,
      exclude: string,
      offset: number,
      limit: number,
    ) =>
      wrap(
        () =>
          invoke("fs_search_content_filter", {
            root,
            query,
            matchCase,
            matchWholeWord,
            useRegex,
            include,
            exclude,
            offset,
            limit,
          }),
        (result) => result,
      ),
    searchContentFiles: (
      root: string,
      query: string,
      matchCase?: boolean,
      matchWholeWord?: boolean,
      useRegex?: boolean,
      include?: string,
      exclude?: string,
      maxFiles?: number,
    ) =>
      wrap(
        () =>
          invoke("fs_search_content_files", {
            root,
            query,
            matchCase,
            matchWholeWord,
            useRegex,
            include,
            exclude,
            maxFiles,
          }),
        (result: any) => ({ files: result.files, totalMatches: result.totalMatches }),
      ),
    highlightLines: (lines: string[], fileName: string, query: string, matchCase: boolean) =>
      wrap(
        () => invoke("fs_highlight_lines", { lines, fileName, query, matchCase }),
        (result) => result as { text: string; className: string }[][],
      ),
    searchContentFileMatches: (
      root: string,
      query: string,
      matchCase: boolean,
      matchWholeWord: boolean,
      useRegex: boolean,
      include: string,
      exclude: string,
      filePath: string,
      offset: number,
      limit: number,
    ) =>
      wrap(
        () =>
          invoke("fs_search_content_file_matches", {
            root,
            query,
            matchCase,
            matchWholeWord,
            useRegex,
            include,
            exclude,
            filePath,
            offset,
            limit,
          }),
        (result: any) => ({ total: result.total, matches: result.matches }),
      ),
    projectInfo: (dir: string) =>
      wrap(() => invoke<{ name: string | null; version: string | null }>("fs_project_info", { dir })),
  },

  whisper: {
    transcribe: (audioBase64: string, mimeType: string) =>
      wrap(() => invoke("whisper_transcribe", { audioBase64, mimeType })),
  },
};
