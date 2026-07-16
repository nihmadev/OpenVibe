import { invoke } from "@tauri-apps/api/core";

export async function mcpGetServers(): Promise<import("../types.js").McpServerStatus[]> {
  return invoke("mcp_get_servers");
}

export async function mcpStartServer(name: string): Promise<void> {
  return invoke("mcp_start_server", { name });
}

export async function mcpStopServer(name: string): Promise<void> {
  return invoke("mcp_stop_server", { name });
}

export async function mcpRestartServer(name: string): Promise<void> {
  return invoke("mcp_restart_server", { name });
}

export async function mcpGetStatus(name: string): Promise<import("../types.js").McpStatus> {
  return invoke("mcp_get_status", { name });
}

export async function mcpGetConfig(): Promise<import("../types.js").McpConfig> {
  return invoke("mcp_get_config");
}

export async function mcpSaveConfig(config: import("../types.js").McpConfig): Promise<void> {
  return invoke("mcp_save_config", { config });
}

export async function mcpListTools(serverName: string): Promise<string[]> {
  return invoke("mcp_list_tools", { serverName });
}

export interface SCG2EventBatch {
  active_file?: string;
  cursor?: { line: number; column: number };
  visible_ranges: { start_line: number; end_line: number }[];
  selection?: {
    start_line: number;
    start_column: number;
    end_line: number;
    end_column: number;
    selected_text: string;
  };
  diagnostics?: {
    message: string;
    severity: string;
    start_line: number;
    end_line: number;
    file_path?: string;
  }[];
  is_edit?: boolean;
  timestamp_ms?: number;
}

export async function pushScg2Events(batch: SCG2EventBatch): Promise<void> {
  await invoke("scg2_push_events", { batch }).catch(() => {});
}
