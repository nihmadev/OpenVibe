// Typed Tauri adapter for filesystem commands (owned by the files feature).
import { invoke } from "@tauri-apps/api/core";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import { type Result, wrap } from "@/infrastructure/tauri/helpers";
import type { FileMatch, FsEntry } from "../model/fs";

export const fsApi = {
  list: (dir: string): Promise<Result<{ entries: FsEntry[] }>> =>
    wrap(
      () => invoke<FsEntry[]>("fs_list", { dir }),
      (entries) => ({ entries }),
    ),

  reveal: async (path: string): Promise<void> => {
    try {
      await shellOpen(path);
    } catch {
      /* ignore */
    }
  },

  read: (path: string): Promise<Result<{ content: string }>> =>
    wrap(
      () => invoke<string>("fs_read", { path }),
      (content) => ({ content }),
    ),

  readBinary: (path: string): Promise<Result<{ data: string; size: number }>> =>
    wrap(
      () => invoke<{ data: string; size: number }>("fs_read_binary", { path }),
      (r) => r,
    ),

  write: (path: string, content: string): Promise<Result<object>> =>
    wrap(
      () => invoke("fs_write", { path, content }),
      () => ({}),
    ),

  rename: (from: string, to: string): Promise<Result<object>> =>
    wrap(
      () => invoke("fs_rename", { from, to }),
      () => ({}),
    ),

  delete: (filePath: string): Promise<Result<object>> =>
    wrap(
      () => invoke("fs_delete", { path: filePath }),
      () => ({}),
    ),

  createFile: (dir: string, name: string): Promise<Result<{ path: string }>> =>
    wrap(
      () => invoke<string>("fs_create_file", { dir, name }),
      (path) => ({ path }),
    ),

  createDir: (dir: string, name: string): Promise<Result<{ path: string }>> =>
    wrap(
      () => invoke<string>("fs_create_dir", { dir, name }),
      (path) => ({ path }),
    ),

  find: (root: string, query: string, limit?: number): Promise<Result<{ matches: FileMatch[] }>> =>
    wrap(
      () => invoke<FileMatch[]>("fs_find", { root, query, limit }),
      (matches) => ({ matches }),
    ),

  findAll: (root: string, query: string, limit?: number): Promise<Result<{ matches: FileMatch[] }>> =>
    wrap(
      () => invoke<FileMatch[]>("fs_find_all", { root, query, limit }),
      (matches) => ({ matches }),
    ),

  projectInfo: (dir: string): Promise<Result<{ name: string | null; version: string | null }>> =>
    wrap(
      () => invoke<{ name: string | null; version: string | null }>("fs_project_info", { dir }),
      (r) => r,
    ),
};

/** Open a native folder picker; returns the chosen path or null. */
export async function pickWorkspaceFolder(): Promise<string | null> {
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const folder = await open({ directory: true, multiple: false });
    return typeof folder === "string" ? folder : null;
  } catch {
    return null;
  }
}

/** Subscribe to backend filesystem-change notifications. */
export function onFsChanged(cb: () => void): () => void {
  const handler = () => cb();
  window.addEventListener("vibe:fs:changed", handler);
  return () => window.removeEventListener("vibe:fs:changed", handler);
}
