import { appState } from "@/platform/storage/common/keyValueStore";

export let zoomStep = 0.2;
export let zoomDefault = 1.2;

export function setZoomStep(value: number) {
  zoomStep = value;
}

export function setZoomDefault(value: number) {
  zoomDefault = value;
}

export async function initZoomConfig(): Promise<void> {
  try {
    const [step, def] = await Promise.all([appState.get("settings:zoomStep"), appState.get("settings:zoomDefault")]);
    if (step !== null) {
      const parsed = parseFloat(step);
      if (!Number.isNaN(parsed) && parsed > 0) zoomStep = parsed;
    }
    if (def !== null) {
      const parsed = parseFloat(def);
      if (!Number.isNaN(parsed) && parsed >= 0.2) zoomDefault = parsed;
    }
  } catch {
    // ignore
  }
}
