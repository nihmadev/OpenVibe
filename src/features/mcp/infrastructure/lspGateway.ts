// Typed Tauri adapter for LSP server management commands.
import { invoke } from "@tauri-apps/api/core";

export interface LspServerInfo {
  id: string;
  name: string;
}

export const lspGateway = {
  listServers: (): Promise<LspServerInfo[]> => invoke<LspServerInfo[]>("get_lsp_servers"),
  runningServers: (): Promise<string[]> => invoke<string[]>("lsp_running_servers"),
  startServer: (id: string): Promise<void> => invoke("lsp_start_server", { id }),
};
