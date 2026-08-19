import type React from "react";
import { useCallback, useEffect, useState } from "react";

import "./titlebar.css";
import { ContextMenu, type MenuItem } from "@/base/browser/ui/contextMenu/contextMenu";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BurgerIcon,
  CloseIcon,
  MaximizeIcon,
  MinimizeIcon,
  NewSessionIcon,
  SearchIcon,
  SidebarToggleIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useI18n } from "@/platform/localization/localizationService";
import { windowApi } from "@/platform/native/tauri/windowService";

interface TitlebarProps {
  chatSideOpen?: boolean;
  onToggleChatSide?: () => void;
  onNewChat?: () => void;
  onSwitchChat?: (direction: "prev" | "next") => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  terminalOpen?: boolean;
  onToggleTerminal?: () => void;
  searchInCodeOpen?: boolean;
  onToggleSearchInCode?: () => void;
  fileTreeOpen?: boolean;
  onToggleFileTree?: () => void;
  folder?: string | null;
  onSearchOpen?: () => void;
  onOpenSettings?: (tab?: string) => void;
  gitPanelOpen?: boolean;
  onToggleGitPanel?: () => void;
}

const STORAGE_KEY = "titlebar:hidden";

type BtnId =
  | "sidebar"
  | "new-session"
  | "nav-prev"
  | "nav-next"
  | "terminal"
  | "search-in-code"
  | "file-tree"
  | "git-panel"
  | "servers";

function loadHidden(): Set<BtnId> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set<BtnId>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<BtnId>();
  }
}

function folderLabel(folder: string | null | undefined): string {
  if (!folder) return "openvibe";
  const parts = folder.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || "openvibe";
}

const LEFT_BTNS: BtnId[] = ["sidebar", "new-session", "nav-prev", "nav-next"];
const RIGHT_BTNS: BtnId[] = ["servers", "terminal", "search-in-code", "git-panel", "file-tree"];
const ALL_BTNS: BtnId[] = [...LEFT_BTNS, ...RIGHT_BTNS];

export function Titlebar({
  chatSideOpen = false,
  onToggleChatSide = () => {},
  onNewChat = () => {},
  onSwitchChat = () => {},
  canGoBack = false,
  canGoForward = false,
  fileTreeOpen = false,
  folder,
  onSearchOpen = () => {},
  onOpenSettings: _onOpenSettings,
  gitPanelOpen = false,
}: TitlebarProps): React.ReactElement {
  const { t } = useI18n();
  const [hidden, setHidden] = useState<Set<BtnId>>(loadHidden);
  const [hiding, setHiding] = useState<Set<BtnId>>(new Set());
  const [showing, setShowing] = useState<Set<BtnId>>(new Set());
  const [ctx, setCtx] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const handleWindowDrag = (event: React.MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (!target || typeof target.closest !== "function") return;
    if (
      target.closest(
        "button, input, select, textarea, a, [role=button], .titlebar__action-btn, .titlebar__search, .titlebar__btn, .titlebar__mcp-container, .titlebar__mcp-dropdown",
      )
    ) {
      return;
    }
    void windowApi.startDragging().catch(() => {});
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  }, [hidden]);

  const hide = useCallback((id: BtnId) => {
    setHiding((p) => new Set(p).add(id));
    setTimeout(() => {
      setHiding((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      setHidden((p) => new Set(p).add(id));
    }, 250);
  }, []);

  const unhide = useCallback((id: BtnId) => {
    setHidden((p) => {
      const n = new Set(p);
      n.delete(id);
      return n;
    });
    setShowing((p) => new Set(p).add(id));
    setTimeout(() => {
      setShowing((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
    }, 250);
  }, []);

  function btnLabel(id: BtnId): string {
    switch (id) {
      case "sidebar":
        return chatSideOpen ? t("hideSessions") : t("showSessions");
      case "new-session":
        return t("newSessionTitle");
      case "nav-prev":
        return t("prevSessionTitle");
      case "nav-next":
        return t("nextSessionTitle");
      case "terminal":
        return t("toggleTerminal");
      case "search-in-code":
        return t("searchInCode");
      case "git-panel":
        return gitPanelOpen ? "Hide Source Control" : "Show Source Control";
      case "file-tree":
        return fileTreeOpen ? t("hideFileTree") : t("showFileTree");
      case "servers":
        return "Servers";
    }
  }

  function isVisible(id: BtnId): boolean {
    if (hiding.has(id)) return true;
    if (hidden.has(id) && !showing.has(id)) return false;
    return true;
  }

  function btnClasses(id: BtnId, extra = ""): string {
    let cls = "z-icon-button z-icon-button--large titlebar__action-btn";
    if (extra) cls += ` ${extra}`;
    if (hiding.has(id)) cls += " titlebar__action-btn--hiding";
    if (showing.has(id)) cls += " titlebar__action-btn--showing";
    return cls;
  }

  function onBtnCtx(e: React.MouseEvent, id: BtnId): void {
    e.preventDefault();
    e.stopPropagation();
    setCtx({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: `${t("hideButton")} «${btnLabel(id)}»`,
          onClick: () => hide(id),
        },
      ],
    });
  }

  function onSectionCtx(e: React.MouseEvent, ids: BtnId[]): void {
    e.preventDefault();
    const hiddenHere = ids.filter((id) => hidden.has(id) && !showing.has(id));
    if (hiddenHere.length === 0) return;
    setCtx({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: t("restoreButtons"), disabled: true },
        ...hiddenHere.map((id) => ({
          label: `${t("showButton")} «${btnLabel(id)}»`,
          onClick: () => unhide(id),
        })),
      ],
    });
  }

  return (
    <div className="titlebar" onMouseDown={handleWindowDrag} onContextMenu={(e) => onSectionCtx(e, ALL_BTNS)}>
      <div className="titlebar__left" onContextMenu={(e) => onSectionCtx(e, LEFT_BTNS)}>
        <Tooltip text={t("menu")} side="bottom">
          <button
            className="z-icon-button z-icon-button--large titlebar__action-btn"
            aria-label={t("menu")}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <BurgerIcon />
          </button>
        </Tooltip>
        {isVisible("sidebar") && (
          <Tooltip text={chatSideOpen ? t("hideSessions") : t("showSessions")} side="bottom">
            <button
              className={btnClasses("sidebar", chatSideOpen ? "titlebar__action-btn--active" : "")}
              onClick={onToggleChatSide}
              onContextMenu={(e) => onBtnCtx(e, "sidebar")}
              aria-label={t("toggleSessions")}
            >
              <SidebarToggleIcon />
            </button>
          </Tooltip>
        )}
        {isVisible("new-session") && (
          <Tooltip text={t("newSessionTitle")} side="bottom">
            <button
              className={btnClasses("new-session")}
              onClick={onNewChat}
              onContextMenu={(e) => onBtnCtx(e, "new-session")}
              aria-label={t("newSessionTitle")}
            >
              <NewSessionIcon />
            </button>
          </Tooltip>
        )}
        <div className="titlebar__nav-group">
          {isVisible("nav-prev") && (
            <Tooltip text={t("prevSessionTitle")} side="bottom">
              <button
                className={btnClasses("nav-prev")}
                onClick={() => onSwitchChat("prev")}
                disabled={!canGoBack}
                onContextMenu={(e) => onBtnCtx(e, "nav-prev")}
                aria-label={t("prevSessionTitle")}
              >
                <ArrowLeftIcon />
              </button>
            </Tooltip>
          )}
          {isVisible("nav-next") && (
            <Tooltip text={t("nextSessionTitle")} side="bottom">
              <button
                className={btnClasses("nav-next")}
                onClick={() => onSwitchChat("next")}
                disabled={!canGoForward}
                onContextMenu={(e) => onBtnCtx(e, "nav-next")}
                aria-label={t("nextSessionTitle")}
              >
                <ArrowRightIcon />
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="titlebar__center">
        <button type="button" className="titlebar__search" onClick={onSearchOpen}>
          <SearchIcon />
          <span className="titlebar__search-text">{t("searchIn", { folder: folderLabel(folder) })}</span>
        </button>
      </div>

      <div className="titlebar__right">
        <div className="titlebar__controls">
          <button
            className="titlebar__btn"
            onClick={() => windowApi.minimize()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label={t("minimizeLabel")}
          >
            <MinimizeIcon />
          </button>
          <button
            className="titlebar__btn"
            onClick={() => windowApi.maximize()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label={t("maximizeLabel")}
          >
            <MaximizeIcon />
          </button>
          <button
            className="titlebar__btn titlebar__btn--close"
            onClick={() => windowApi.close()}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            aria-label={t("closeLabel")}
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctx.items} onClose={() => setCtx(null)} />}
    </div>
  );
}
