// MCP server contracts (owned by the mcp feature).

export type McpStatus =
  | { type: "starting" }
  | { type: "running" }
  | { type: "stopped" }
  | { type: "error"; message: string };

export interface McpServerStatus {
  name: string;
  status: McpStatus;
  enabled: boolean;
  error?: string;
}

export interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
}

export interface McpConfig {
  servers: McpServerConfig[];
}
