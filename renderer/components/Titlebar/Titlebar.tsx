import React from "react";
import "../../styles/Titlebar.css";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useI18n } from "../../hooks/useI18n.js";
import {
  BurgerIcon,
  SidebarToggleIcon,
  NewSessionIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SearchIcon,
  TerminalIcon,
  FolderToggleIcon,
} from "../icons/index.js";

interface TitlebarProps {
  chatSideOpen?: boolean;
  onToggleChatSide?: () => void;
  onNewChat?: () => void;
  onSwitchChat?: (direction: "prev" | "next") => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
  fileTreeOpen?: boolean;
  onToggleFileTree?: () => void;
  folder?: string | null;
  onSearchOpen?: () => void;
}

function folderLabel(folder: string | null | undefined): string {
  if (!folder) return "openvibe";
  const parts = folder.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "openvibe";
}

export function Titlebar({
  chatSideOpen = false,
  onToggleChatSide = () => {},
  onNewChat = () => {},
  onSwitchChat = () => {},
  canGoBack = false,
  canGoForward = false,
  terminalOpen = false,
  onToggleTerminal = () => {},
  fileTreeOpen = false,
  onToggleFileTree = () => {},
  folder,
  onSearchOpen = () => {},
}: TitlebarProps): React.ReactElement {
  const { t } = useI18n();
  return (
    <div className="titlebar">
      <div className="titlebar__left">
        <Tooltip text={t("menu")} side="bottom">
          <button className="titlebar__action-btn" aria-label={t("menu")}>
            <BurgerIcon />
          </button>
        </Tooltip>
        <Tooltip text={chatSideOpen ? t("hideSessions") : t("showSessions")} side="bottom">
          <button
            className={`titlebar__action-btn ${chatSideOpen ? "titlebar__action-btn--active" : ""}`}
            onClick={onToggleChatSide}
            aria-label="Toggle sessions"
          >
            <SidebarToggleIcon />
          </button>
        </Tooltip>
        <Tooltip text={t("newSessionTitle")} side="bottom">
          <button className="titlebar__action-btn" onClick={onNewChat} aria-label={t("newSessionTitle")}>
            <NewSessionIcon />
          </button>
        </Tooltip>
        <div className="titlebar__nav-group">
          <Tooltip text={t("prevSessionTitle")} side="bottom">
            <button
              className="titlebar__action-btn"
              onClick={() => onSwitchChat("prev")}
              disabled={!canGoBack}
              aria-label={t("prevSessionTitle")}
            >
              <ArrowLeftIcon />
            </button>
          </Tooltip>
          <Tooltip text={t("nextSessionTitle")} side="bottom">
            <button
              className="titlebar__action-btn"
              onClick={() => onSwitchChat("next")}
              disabled={!canGoForward}
              aria-label={t("nextSessionTitle")}
            >
              <ArrowRightIcon />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="titlebar__center">
        <div className="titlebar__search" onClick={onSearchOpen}>
          <SearchIcon />
          <span className="titlebar__search-text">{t("searchIn", { folder: folderLabel(folder) })}</span>
        </div>
      </div>

      <div className="titlebar__right">
        <Tooltip text={t("toggleTerminal")} side="bottom">
          <button
            className={`titlebar__action-btn ${terminalOpen ? "titlebar__action-btn--active" : ""}`}
            onClick={onToggleTerminal}
            aria-label={t("toggleTerminal")}
          >
            <TerminalIcon />
          </button>
        </Tooltip>
        <Tooltip text={fileTreeOpen ? t("hideFileTree") : t("showFileTree")} side="bottom">
          <button
            className={`titlebar__action-btn ${fileTreeOpen ? "titlebar__action-btn--active" : ""}`}
            onClick={onToggleFileTree}
            aria-label="Toggle file tree"
          >
            <FolderToggleIcon />
          </button>
        </Tooltip>

        <div className="titlebar__controls">
          <button
            className="titlebar__btn"
            onClick={() => window.vibe.window.minimize()}
            aria-label={t("minimizeLabel")}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M1 5h8" />
            </svg>
          </button>
          <button
            className="titlebar__btn"
            onClick={() => window.vibe.window.maximize()}
            aria-label={t("maximizeLabel")}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1" y="1" width="8" height="8" />
            </svg>
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            onClick={() => window.vibe.window.close()}
            aria-label={t("closeLabel")}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M1 1l8 8M9 1l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
