import type { ProviderTemplate } from "@/features/providers/model/providerTemplates";
import type { KeyCombo, ShortcutDef } from "@/features/shortcuts/application/useShortcuts";

export type SettingsTab = "general" | "design" | "code" | "providers" | "models" | "hotkeys" | "mcp";

export interface SettingsProps {
  open: boolean;
  onClose: () => void;
  onProviderChanged?: (model: string, baseUrl: string) => void;
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  onLanguageChange?: (lang: string) => void;
  shortcuts?: ShortcutDef[];
  onUpdateBinding?: (id: string, combo: KeyCombo) => Promise<void>;
  onResetBinding?: (id: string) => Promise<void>;
}

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
}

export interface EditingProvider {
  template: ProviderTemplate | null;
  custom: boolean;
  editId?: string;
}
