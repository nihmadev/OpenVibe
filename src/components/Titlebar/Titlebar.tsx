import React, { useState, useEffect, useCallback, useRef } from "react";

import "../../styles/Titlebar.css";
import { Tooltip } from "../Tooltip/Tooltip.js";
import { useI18n } from "../../hooks/useI18n.js";
import { ContextMenu, type MenuItem } from "../ContextMenu/ContextMenu.js";
import {
  BurgerIcon,
  SidebarToggleIcon,
  NewSessionIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SearchIcon,
  TerminalIcon,
  FolderToggleIcon,
  SearchInCodeIcon,
  MinimizeIcon,
  MaximizeIcon,
  CloseIcon,
} from "../icons/index.js";
import { Server } from "lucide-react";

import { McpStatusDropdown } from "./McpStatusDropdown.js";
import { mcpGetServers, mcpStartServer, mcpStopServer } from "../../tauri-bridge.js";
import type { McpServerStatus } from "../../types.js";

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
}

const STORAGE_KEY = "titlebar:hidden";

type BtnId = "sidebar" | "new-session" | "nav-prev" | "nav-next" | "terminal" | "search-in-code" | "file-tree";

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
const RIGHT_BTNS: BtnId[] = ["terminal", "search-in-code", "file-tree"];

export function Titlebar({
  chatSideOpen = false,
  onToggleChatSide = () => {},
  onNewChat = () => {},
  onSwitchChat = () => {},
  canGoBack = false,
  canGoForward = false,
  terminalOpen = false,
  onToggleTerminal = () => {},
  searchInCodeOpen = false,
  onToggleSearchInCode = () => {},
  fileTreeOpen = false,
  onToggleFileTree = () => {},
  folder,
  onSearchOpen = () => {},
  onOpenSettings,
}: TitlebarProps): React.ReactElement {
  const { t } = useI18n();
  const [hidden, setHidden] = useState<Set<BtnId>>(loadHidden);
  const [hiding, setHiding] = useState<Set<BtnId>>(new Set());
  const [showing, setShowing] = useState<Set<BtnId>>(new Set());
  const [ctx, setCtx] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null);

  const [mcpServers, setMcpServers] = useState<McpServerStatus[]>([]);
  const [mcpDropdownOpen, setMcpDropdownOpen] = useState(false);

  const fetchMcpServers = useCallback(async () => {
    try {
      const list = await mcpGetServers();
      setMcpServers(list || []);
    } catch {
      // Ignore if backend not connected or error
    }
  }, []);

  const mcpContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mcpDropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (mcpContainerRef.current && !mcpContainerRef.current.contains(e.target as Node)) {
        setMcpDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mcpDropdownOpen]);

  useEffect(() => {
    fetchMcpServers();
    const interval = setInterval(fetchMcpServers, 5000);
    return () => clearInterval(interval);
  }, [fetchMcpServers]);

  const handleToggleMcpServer = async (name: string, enable: boolean) => {
    try {
      if (enable) {
        await mcpStartServer(name);
      } else {
        await mcpStopServer(name);
      }
      fetchMcpServers();
    } catch (e) {
      console.error("Failed to toggle MCP server:", e);
    }
  };

  const getMcpGlobalDotClass = (servers: McpServerStatus[]) => {
    if (servers.length === 0) return "titlebar__mcp-dot--gray";
    const enabled = servers.filter((s) => s.enabled);
    if (enabled.length === 0) return "titlebar__mcp-dot--gray";

    const runningCount = enabled.filter((s) => s.status.type === "running").length;

    if (runningCount === enabled.length) return "titlebar__mcp-dot--green";
    if (runningCount > 0) return "titlebar__mcp-dot--yellow";
    return "titlebar__mcp-dot--red";
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
      case "file-tree":
        return fileTreeOpen ? t("hideFileTree") : t("showFileTree");
    }
  }

  function isVisible(id: BtnId): boolean {
    if (hiding.has(id)) return true;
    if (hidden.has(id) && !showing.has(id)) return false;
    return true;
  }

  function btnClasses(id: BtnId, extra = ""): string {
    let cls = "titlebar__action-btn";
    if (extra) cls += " " + extra;
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
    <div className="titlebar">
      <div className="titlebar__left" onContextMenu={(e) => onSectionCtx(e, LEFT_BTNS)}>
        <Tooltip text={t("menu")} side="bottom">
          <button
            className="titlebar__action-btn"
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
              aria-label="Toggle sessions"
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
        <div className="titlebar__search" onClick={onSearchOpen}>
          <SearchIcon />
          <span className="titlebar__search-text">{t("searchIn", { folder: folderLabel(folder) })}</span>
        </div>
      </div>

      <div className="titlebar__right" onContextMenu={(e) => onSectionCtx(e, RIGHT_BTNS)}>
        <div className="titlebar__mcp-container" ref={mcpContainerRef}>
          <Tooltip text={t("mcpServers")} side="bottom">
            <button
              className={`titlebar__action-btn titlebar__mcp-btn ${mcpDropdownOpen ? "titlebar__action-btn--active" : ""}`}
              onClick={() => {
                fetchMcpServers();
                setMcpDropdownOpen(!mcpDropdownOpen);
              }}
              aria-label={t("mcpServers")}
            >
              <Server size={15} />

              <span className={`titlebar__mcp-badge ${getMcpGlobalDotClass(mcpServers)}`} />
            </button>
          </Tooltip>
          {mcpDropdownOpen && (
            <McpStatusDropdown
              servers={mcpServers}
              onToggleServer={handleToggleMcpServer}
              onOpenSettings={() => {
                setMcpDropdownOpen(false);
                if (onOpenSettings) onOpenSettings("mcp");
              }}
              onRefresh={fetchMcpServers}
            />
          )}
        </div>
        {isVisible("terminal") && (
          <Tooltip text={t("toggleTerminal")} side="bottom">
            <button
              className={btnClasses("terminal", terminalOpen ? "titlebar__action-btn--active" : "")}
              onClick={onToggleTerminal}
              onContextMenu={(e) => onBtnCtx(e, "terminal")}
              aria-label={t("toggleTerminal")}
            >
              <TerminalIcon />
            </button>
          </Tooltip>
        )}
        {isVisible("search-in-code") && (
          <Tooltip text={t("searchInCode")} side="bottom">
            <button
              className={btnClasses("search-in-code")}
              onClick={onToggleSearchInCode}
              onContextMenu={(e) => onBtnCtx(e, "search-in-code")}
              aria-label={t("searchInCode")}
            >
              <SearchInCodeIcon />
            </button>
          </Tooltip>
        )}
        {isVisible("file-tree") && (
          <Tooltip text={fileTreeOpen ? t("hideFileTree") : t("showFileTree")} side="bottom">
            <button
              className={btnClasses("file-tree", fileTreeOpen ? "titlebar__action-btn--active" : "")}
              onClick={onToggleFileTree}
              onContextMenu={(e) => onBtnCtx(e, "file-tree")}
              aria-label={t("toggleFileTree")}
            >
              <FolderToggleIcon />
            </button>
          </Tooltip>
        )}
        <div className="titlebar__controls">
          <button
            className="titlebar__btn"
            onClick={() => window.vibe.window.minimize()}
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
            onClick={() => window.vibe.window.maximize()}
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
            onClick={() => window.vibe.window.close()}
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
