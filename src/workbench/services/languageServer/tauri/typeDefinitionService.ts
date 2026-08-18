// Typed Tauri adapter for editor-specific commands.
import { invoke } from "@tauri-apps/api/core";
import { type Result, wrap } from "@/platform/native/common/nativeResult";
import type { PreloadedTypes } from "../common/languageServer";

export const typeDefinitionService = {
  preloadTypes: (cwd: string): Promise<Result<PreloadedTypes>> =>
    wrap(
      () => invoke<PreloadedTypes>("editor_preload_types", { cwd }),
      (result) => ({ types: result.types, packages: result.packages }),
    ),
};
