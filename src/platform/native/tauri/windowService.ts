import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Native window controls exposed to the shell and onboarding flows. */
export const windowApi = {
  startDragging: (): Promise<void> => getCurrentWindow().startDragging(),
  minimize: (): Promise<void> => invoke("window_minimize"),
  maximize: (): Promise<void> => invoke("window_maximize"),
  close: (): Promise<void> => invoke("window_close"),
  setSize: (width: number, height: number): Promise<void> => invoke("window_set_size", { width, height }),
  setFullscreen: (fullscreen: boolean): Promise<void> => invoke("window_set_fullscreen", { fullscreen }),
  zoom: (factor: number): Promise<void> => invoke("window_zoom", { factor }),
};
