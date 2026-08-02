// Typed Tauri adapter for editor-specific commands.
import { invoke } from "@tauri-apps/api/core";
import { type Result, wrap } from "@/infrastructure/tauri/helpers";

export interface PreloadedTypes {
  types: Array<{ path: string; content: string }>;
  packages: Array<{ name: string; typePath: string; content: string }>;
}

export const editorGateway = {
  preloadTypes: (cwd: string): Promise<Result<PreloadedTypes>> =>
    wrap(
      () => invoke<PreloadedTypes>("editor_preload_types", { cwd }),
      (result) => ({ types: result.types, packages: result.packages }),
    ),
};
