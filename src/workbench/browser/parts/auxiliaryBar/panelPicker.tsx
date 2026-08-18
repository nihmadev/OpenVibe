import * as PopoverPrimitive from "@radix-ui/react-popover";
import type React from "react";
import {
  CloseIcon,
  FolderTreeIcon,
  GitBranchIcon,
  GlobeIcon,
  SearchInCodeIcon,
  ServerIcon,
  TerminalIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useI18n } from "@/platform/localization/localizationService";
import "./panelPicker.css";

interface WorkspacePanelPickerProps {
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

export function WorkspacePanelPicker({
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
}: WorkspacePanelPickerProps): React.ReactElement {
  const { t } = useI18n();

  const anyOpen = fileTreeOpen || searchInCodeOpen || gitPanelOpen || terminalOpen || browserOpen;

  return (
    <div className="workspace-panel-picker">
      <PopoverPrimitive.Root>
        <Tooltip text={t("panels" as any) || "Toggle Panels"} side="bottom">
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              className={`workspace-panel-picker__trigger${anyOpen ? " workspace-panel-picker__trigger--active" : ""}`}
              aria-label="Toggle Panels"
            >
              {/* Split / Layout Panels Icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M15 3v18" />
              </svg>
              {anyOpen && <span className="workspace-panel-picker__dot" />}
            </button>
          </PopoverPrimitive.Trigger>
        </Tooltip>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content className="workspace-panel-picker__content" align="end" sideOffset={8}>
            <div className="workspace-panel-picker__header">
              <span className="workspace-panel-picker__title">{t("panels" as any) || "Workspaces & Panels"}</span>
              <PopoverPrimitive.Close asChild>
                <button type="button" className="workspace-panel-picker__close-btn" aria-label="Close">
                  <CloseIcon size={12} />
                </button>
              </PopoverPrimitive.Close>
            </div>

            <div className="workspace-panel-picker__grid">
              {/* Files */}
              <button
                type="button"
                className={`workspace-panel-picker__card${fileTreeOpen ? " workspace-panel-picker__card--active" : ""}`}
                onClick={onToggleFileTree}
              >
                <div className="workspace-panel-picker__card-icon">
                  <FolderTreeIcon size={16} />
                </div>
                <div className="workspace-panel-picker__card-info">
                  <span className="workspace-panel-picker__card-title">{t("files" as any) || "Files"}</span>
                  <span className="workspace-panel-picker__card-desc">Explorer</span>
                </div>
                <div
                  className={`workspace-panel-picker__badge${fileTreeOpen ? " workspace-panel-picker__badge--on" : ""}`}
                >
                  {fileTreeOpen ? "Active" : "Off"}
                </div>
              </button>

              {/* Search in Code */}
              <button
                type="button"
                className={`workspace-panel-picker__card${searchInCodeOpen ? " workspace-panel-picker__card--active" : ""}`}
                onClick={onToggleSearchInCode}
              >
                <div className="workspace-panel-picker__card-icon">
                  <SearchInCodeIcon size={16} />
                </div>
                <div className="workspace-panel-picker__card-info">
                  <span className="workspace-panel-picker__card-title">{t("searchInCode" as any) || "Search"}</span>
                  <span className="workspace-panel-picker__card-desc">In workspace</span>
                </div>
                <div
                  className={`workspace-panel-picker__badge${searchInCodeOpen ? " workspace-panel-picker__badge--on" : ""}`}
                >
                  {searchInCodeOpen ? "Active" : "Off"}
                </div>
              </button>

              {/* Git Panel */}
              <button
                type="button"
                className={`workspace-panel-picker__card${gitPanelOpen ? " workspace-panel-picker__card--active" : ""}`}
                onClick={onToggleGitPanel}
              >
                <div className="workspace-panel-picker__card-icon">
                  <GitBranchIcon size={16} />
                </div>
                <div className="workspace-panel-picker__card-info">
                  <span className="workspace-panel-picker__card-title">Git</span>
                  <span className="workspace-panel-picker__card-desc">Source Control</span>
                </div>
                <div
                  className={`workspace-panel-picker__badge${gitPanelOpen ? " workspace-panel-picker__badge--on" : ""}`}
                >
                  {gitPanelOpen ? "Active" : "Off"}
                </div>
              </button>

              {/* Terminal */}
              <button
                type="button"
                className={`workspace-panel-picker__card${terminalOpen ? " workspace-panel-picker__card--active" : ""}`}
                onClick={onToggleTerminal}
              >
                <div className="workspace-panel-picker__card-icon">
                  <TerminalIcon size={16} />
                </div>
                <div className="workspace-panel-picker__card-info">
                  <span className="workspace-panel-picker__card-title">{t("terminal" as any) || "Terminal"}</span>
                  <span className="workspace-panel-picker__card-desc">Shell runner</span>
                </div>
                <div
                  className={`workspace-panel-picker__badge${terminalOpen ? " workspace-panel-picker__badge--on" : ""}`}
                >
                  {terminalOpen ? "Active" : "Off"}
                </div>
              </button>

              {/* Isolated Chromium browser */}
              <button
                type="button"
                className={`workspace-panel-picker__card${browserOpen ? " workspace-panel-picker__card--active" : ""}`}
                onClick={onToggleBrowser}
              >
                <div className="workspace-panel-picker__card-icon">
                  <GlobeIcon size={16} />
                </div>
                <div className="workspace-panel-picker__card-info">
                  <span className="workspace-panel-picker__card-title">{t("browserTitle")}</span>
                  <span className="workspace-panel-picker__card-desc">Chromium</span>
                </div>
                <div
                  className={`workspace-panel-picker__badge${browserOpen ? " workspace-panel-picker__badge--on" : ""}`}
                >
                  {browserOpen ? "Active" : "Off"}
                </div>
              </button>
            </div>

            {/* Footer quick links */}
            {onOpenSettings && (
              <div className="workspace-panel-picker__footer">
                <button
                  type="button"
                  className="workspace-panel-picker__footer-btn"
                  onClick={() => onOpenSettings("mcp")}
                >
                  <ServerIcon size={13} />
                  <span>Configure MCP & LSP Servers</span>
                </button>
              </div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
