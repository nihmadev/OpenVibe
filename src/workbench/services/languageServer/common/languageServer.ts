export interface LspServerInfo {
  id: string;
  name: string;
}

export interface LspServerItem {
  id: string;
  name: string;
  enabled: boolean;
  status: "running" | "stopped" | "error" | "installing";
}

export interface PreloadedTypes {
  types: Array<{ path: string; content: string }>;
  packages: Array<{ name: string; typePath: string; content: string }>;
}
