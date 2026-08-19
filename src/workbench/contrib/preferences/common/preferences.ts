export type { SettingsTab } from "@/workbench/common/preferences";

export const DEFAULT_GENERAL_SETTINGS = {
  language: "Russian",
  font: "Segoe UI",
  codeFont: "JetBrains Mono",
  autoAccept: false,
  terminalShell: "powershell",
  showThinking: true,
  expandShell: true,
  expandEdit: true,
  showProgress: true,
  soundEnabled: true,
  soundOnComplete: true,
  soundOnStop: true,
  zoomStep: "0.2",
  zoomDefault: "1.2",
  radius: "10",
  blur: "none",
  editorFontSize: "13",
  editorLineHeight: "1.5",
  editorLigatures: false,
  editorCursorStyle: "line",
  editorCursorBlink: "blink",
  borderStyle: "bordered",
  tabStyle: "default",
  renderFileTree: false,
  useRegionalProxy: true,
  promptMarkdown: true,
  promptMarkdownGhost: false,
  experimentalExtremeRadius: false,
};

export type GeneralSettings = typeof DEFAULT_GENERAL_SETTINGS;
export type UpdateGeneral = (key: keyof GeneralSettings, value: string | boolean) => void;

export interface DiscoveredModel {
  id: string;
  name: string;
  providerId: string;
  providerDbId: string;
  providerName: string;
  providerIcon: string;
  description?: string;
  contextLimit?: number;
  supportsVision?: boolean;
  supportsReasoning?: boolean;
  cost?: { input?: number; output?: number; cache_read?: number };
}
