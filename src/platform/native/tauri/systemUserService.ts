import { invoke } from "@tauri-apps/api/core";

/** Returns the operating-system account name reported by the native host. */
export function getSystemUser(): Promise<string> {
  return invoke<string>("get_system_user");
}
