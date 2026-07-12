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
    const vibe = (window as any).vibe;
    if (!vibe?.state) return;
    const [step, def] = await Promise.all([
      vibe.state.get("settings:zoomStep"),
      vibe.state.get("settings:zoomDefault"),
    ]);
    if (step !== null) {
      const parsed = parseFloat(step);
      if (!isNaN(parsed) && parsed > 0) zoomStep = parsed;
    }
    if (def !== null) {
      const parsed = parseFloat(def);
      if (!isNaN(parsed) && parsed >= 0.2) zoomDefault = parsed;
    }
  } catch {
    // ignore
  }
}
