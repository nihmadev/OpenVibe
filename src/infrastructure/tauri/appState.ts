import { invoke } from "@tauri-apps/api/core";
import type { KeyValueStore } from "@/shared/api/keyValueStore";

/** Tauri-backed implementation of the shared key-value persistence port. */
export const tauriKeyValueStore: KeyValueStore = {
  get: (key) => invoke<string | null>("state_get", { key }),
  set: (key, value) => invoke("state_set", { key, value }),
};

export function getSystemUser(): Promise<string> {
  return invoke<string>("get_system_user");
}
