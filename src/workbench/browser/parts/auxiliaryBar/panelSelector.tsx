import type React from "react";
import {
  FolderTreeIcon,
  GitBranchIcon,
  GlobeIcon,
  SearchInCodeIcon,
  ServerIcon,
  TerminalIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import "./panelSelector.css";
import type { WorkspaceRightTabId } from "./auxiliaryBar";

interface WorkspaceSelectorPanelProps {
  open: boolean;
  onSelectPanel: (panel: WorkspaceRightTabId) => void;
  fileTreeOpen: boolean;
  onToggleFileTree: () => void;
  searchInCodeOpen: boolean;
  onToggleSearchInCode: () => void;
  gitPanelOpen: boolean;
  onToggleGitPanel: () => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  browserOpen?: boolean;
  onToggleBrowser?: () => void;
  onOpenSettings?: (tab?: string) => void;
}

export function WorkspaceSelectorPanel({
  open,
  onSelectPanel,
  fileTreeOpen,
  onToggleFileTree,
  searchInCodeOpen,
  onToggleSearchInCode,
  gitPanelOpen,
  onToggleGitPanel,
  terminalOpen,
  onToggleTerminal,
  browserOpen = false,
  onToggleBrowser = () => {},
  onOpenSettings,
}: WorkspaceSelectorPanelProps): React.ReactElement | null {
  const { t } = useI18n();

  if (!open) return null;

  const activate = (panel: WorkspaceRightTabId, panelOpen: boolean, action: () => void) => {
    if (!panelOpen) action();
    onSelectPanel(panel);
  };

  return (
    <div className="workspace-selector-panel">
      <div className="workspace-selector-panel__content">
        <div className="workspace-selector-panel__heading">
          <h2>{t("openPanelTitle")}</h2>
          <p>{t("openPanelDescription")}</p>
        </div>

        <div className="workspace-selector-panel__list">
          {/* Git Source Control */}
          <button
            type="button"
            className={`workspace-selector-panel__card workspace-selector-panel__card--git${gitPanelOpen ? " workspace-selector-panel__card--active" : ""}`}
            onClick={() => activate("git", gitPanelOpen, onToggleGitPanel)}
          >
            <span className="workspace-selector-panel__card-icon">
              <GitBranchIcon size={16} />
            </span>
            <span className="workspace-selector-panel__card-label">{t("gitTitle")}</span>
          </button>

          {/* Terminal */}
          <button
            type="button"
            className={`workspace-selector-panel__card workspace-selector-panel__card--terminal${terminalOpen ? " workspace-selector-panel__card--active" : ""}`}
            onClick={() => activate("terminal", terminalOpen, onToggleTerminal)}
          >
            <span className="workspace-selector-panel__card-icon">
              <TerminalIcon size={16} />
            </span>
            <span className="workspace-selector-panel__card-label">{t("terminalTitle")}</span>
            <kbd className="workspace-selector-panel__shortcut">Ctrl+`</kbd>
          </button>

          {/* Search in Code */}
          <button
            type="button"
            className={`workspace-selector-panel__card workspace-selector-panel__card--search${searchInCodeOpen ? " workspace-selector-panel__card--active" : ""}`}
            onClick={() => activate("search", searchInCodeOpen, onToggleSearchInCode)}
          >
            <span className="workspace-selector-panel__card-icon">
              <SearchInCodeIcon size={16} />
            </span>
            <span className="workspace-selector-panel__card-label">{t("searchTitle")}</span>
            <kbd className="workspace-selector-panel__shortcut">Ctrl+Shift+F</kbd>
          </button>

          {/* File Tree */}
          <button
            type="button"
            className={`workspace-selector-panel__card workspace-selector-panel__card--files${fileTreeOpen ? " workspace-selector-panel__card--active" : ""}`}
            onClick={() => activate("files", fileTreeOpen, onToggleFileTree)}
          >
            <span className="workspace-selector-panel__card-icon">
              <FolderTreeIcon size={16} />
            </span>
            <span className="workspace-selector-panel__card-label">{t("filesTitle")}</span>
            <kbd className="workspace-selector-panel__shortcut">Ctrl+Shift+E</kbd>
          </button>

          <button
            type="button"
            className={`workspace-selector-panel__card workspace-selector-panel__card--browser${browserOpen ? " workspace-selector-panel__card--active" : ""}`}
            onClick={() => activate("browser", browserOpen, onToggleBrowser)}
          >
            <span className="workspace-selector-panel__card-icon">
              <GlobeIcon size={16} />
            </span>
            <span className="workspace-selector-panel__card-label">{t("browserTitle")}</span>
          </button>

          {/* MCP & Server Settings */}
          {onOpenSettings && (
            <button
              type="button"
              className="workspace-selector-panel__card workspace-selector-panel__card--servers"
              onClick={() => onOpenSettings("mcp")}
            >
              <span className="workspace-selector-panel__card-icon">
                <ServerIcon size={16} />
              </span>
              <span className="workspace-selector-panel__card-label">{t("serversTitle")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
