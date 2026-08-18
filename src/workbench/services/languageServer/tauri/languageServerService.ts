// Typed Tauri adapter for LSP server management commands.
import { invoke } from "@tauri-apps/api/core";
import type { LspServerInfo } from "../common/languageServer";

export const languageServerService = {
  listServers: (): Promise<LspServerInfo[]> => invoke<LspServerInfo[]>("get_lsp_servers"),
  runningServers: (): Promise<string[]> => invoke<string[]>("lsp_running_servers"),
  startServer: (id: string): Promise<void> => invoke("lsp_start_server", { id }),
};
