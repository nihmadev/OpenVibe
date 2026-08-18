import { invoke } from "@tauri-apps/api/core";
import type { KeyValueStore } from "@/platform/storage/common/keyValueStore";

/** Tauri-backed implementation of the platform key-value persistence port. */
export const tauriKeyValueStore: KeyValueStore = {
  get: (key) => invoke<string | null>("state_get", { key }),
  set: (key, value) => invoke("state_set", { key, value }),
};
