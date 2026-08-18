import type { VibeConfig } from "../common/aiProvider";

let currentConfig: VibeConfig | null = null;

export function getCurrentConfig(): VibeConfig | null {
  return currentConfig;
}

export function setCurrentConfig(config: VibeConfig | null): void {
  currentConfig = config;
}
