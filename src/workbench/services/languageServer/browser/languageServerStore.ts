import type { LspServerItem } from "../common/languageServer";

let servers: LspServerItem[] = [];
let listeners: ((servers: LspServerItem[]) => void)[] = [];

export const languageServerStore = {
  getServers: () => servers,
  setServers: (newServers: LspServerItem[]) => {
    servers = newServers;
    listeners.forEach((l) => {
      l(servers);
    });
  },
  subscribe: (listener: (servers: LspServerItem[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};
