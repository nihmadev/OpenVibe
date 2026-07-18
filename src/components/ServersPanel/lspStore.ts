export interface LspServerItem {
  id: string;
  name: string;
  enabled: boolean;
  status: "running" | "stopped" | "error" | "installing";
}

let servers: LspServerItem[] = [];
let listeners: ((servers: LspServerItem[]) => void)[] = [];

export const lspStore = {
  getServers: () => servers,
  setServers: (newServers: LspServerItem[]) => {
    servers = newServers;
    listeners.forEach((l) => l(servers));
  },
  subscribe: (listener: (servers: LspServerItem[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};
