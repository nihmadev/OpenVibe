// Key-value persistence port. Platform and workbench modules depend on this
// interface only; the concrete backend is registered by the composition root.

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
