// Key-value persistence port. Shared modules depend on this interface only;
// the Tauri-backed implementation is registered during app bootstrap.

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

let store: KeyValueStore = {
  async get() {
    return null;
  },
  async set() {
    /* no-op until bootstrap registers a backend */
  },
};

export function registerKeyValueStore(impl: KeyValueStore): void {
  store = impl;
}

export const appState: KeyValueStore = {
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
};
