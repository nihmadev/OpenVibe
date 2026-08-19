import { surfaceClassName } from "@zazaru/ui";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContextMenu, type MenuItem } from "@/base/browser/ui/contextMenu/contextMenu";
import {
  ChevronRightIcon,
  DotsHorizontalIcon,
  FolderOpenTreeIcon,
  FolderPlusIcon,
  FolderTreeIcon,
  NewSessionIcon,
  PenIcon,
  PlusSmallIcon,
  SearchIcon,
  SettingsIcon,
  TrashIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useScrollMask } from "@/base/browser/ui/useScrollMask";
import { useI18n } from "@/platform/localization/localizationService";
import { browserPreviewChatsByProject, isBrowserDevPreview } from "@/workbench/browser/desktopPreview";
import type { ChatSummary } from "@/workbench/services/chat/common/chat";
import { chatService, onChatsUpdated } from "@/workbench/services/chat/tauri/chatService";
import { fileService } from "@/workbench/services/files/tauri/fileService";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import "./sidebarView.css";

interface SidebarViewProps {
  open: boolean;
  width: number;
  onResize: (width: number) => void;
  onResizingChange?: (resizing: boolean) => void;
  projects: Project[];
  activeProjectId: string | null;
  activeChatId: string | null;
  onPickProject: (id: string) => void | Promise<void>;
  onAddProject: () => void | Promise<void>;
  onRemoveProject: (id: string) => void | Promise<void>;
  onEditProject?: (project: Project) => void;
  onPickChat: (projectId: string | null, chatId: string) => void | Promise<void>;
  onNewChat: (projectId?: string) => void | Promise<void>;
  onDeleteChat: (projectId: string, chatId: string) => void | Promise<void>;
  onRenameChat?: (projectId: string, chatId: string, title: string) => void | Promise<void>;
  onOpenSettings: () => void;
  removingIds?: Set<string>;
}

interface ProjectMenuContext {
  x: number;
  y: number;
  project: Project;
}

interface ChatMenuContext {
  x: number;
  y: number;
  project: Project;
  chat: ChatSummary;
}

interface ProjectChat {
  project: Project;
  chat: ChatSummary;
}

interface RenameDialogState {
  project: Project;
  chat: ChatSummary;
  title: string;
}

const SIDEBAR_MIN_WIDTH = 232;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_CONTENT_RESERVE = 360;
const COLLAPSED_PROJECT_LIMIT = 5;
const PROJECT_CHAT_LIMIT = 4;
const RECENT_CHAT_LIMIT = 10;

function clampSidebarWidth(value: number): number {
  const viewportLimit = typeof window === "undefined" ? SIDEBAR_MAX_WIDTH : window.innerWidth - SIDEBAR_CONTENT_RESERVE;
  const maximum = Math.max(SIDEBAR_MIN_WIDTH, Math.min(SIDEBAR_MAX_WIDTH, viewportLimit));
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(maximum, value));
}

function areChatListsEqual(previous: ChatSummary[] | undefined, next: ChatSummary[]): boolean {
  if (!previous || previous.length !== next.length) return false;
  return previous.every((chat, index) => {
    const candidate = next[index];
    return (
      candidate !== undefined &&
      chat.id === candidate.id &&
      chat.title === candidate.title &&
      chat.updatedAt === candidate.updatedAt &&
      chat.messageCount === candidate.messageCount &&
      chat.status === candidate.status &&
      chat.pinned === candidate.pinned &&
      chat.archived === candidate.archived &&
      chat.unreadAt === candidate.unreadAt
    );
  });
}

function chatTimestamp(chat: ChatSummary): number {
  return chat.updatedAt || chat.createdAt || 0;
}

export function SidebarView({
  open,
  width,
  onResize,
  onResizingChange,
  projects,
  activeProjectId,
  activeChatId,
  onPickProject,
  onAddProject,
  onRemoveProject,
  onEditProject,
  onPickChat,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  onOpenSettings,
  removingIds,
}: SidebarViewProps): React.ReactElement {
  const { t } = useI18n();
  const [localWidth, setLocalWidth] = useState(() => clampSidebarWidth(width));
  const [isResizing, setIsResizing] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(
    () => new Set(activeProjectId ? [activeProjectId] : []),
  );
  const [expandedProjectChats, setExpandedProjectChats] = useState<Set<string>>(() => new Set());
  const [allProjectsVisible, setAllProjectsVisible] = useState(false);
  const [allRecentsVisible, setAllRecentsVisible] = useState(false);
  const [recentsCollapsed, setRecentsCollapsed] = useState(false);
  const [projectChatsMap, setProjectChatsMap] = useState<Record<string, ChatSummary[]>>({});
  const [loadedProjectIds, setLoadedProjectIds] = useState<Set<string>>(() => new Set());
  const [projectMenu, setProjectMenu] = useState<ProjectMenuContext | null>(null);
  const [chatMenu, setChatMenu] = useState<ChatMenuContext | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const loadSequenceRef = useRef<Record<string, number>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { ref: scrollRef, maskStyle } = useScrollMask<HTMLDivElement>();

  useEffect(() => {
    if (!isResizing) setLocalWidth(clampSidebarWidth(width));
  }, [isResizing, width]);

  useEffect(() => {
    if (!activeProjectId) return;
    setExpandedProjectIds((current) => {
      if (current.has(activeProjectId)) return current;
      return new Set(current).add(activeProjectId);
    });
  }, [activeProjectId]);

  const loadChatsForProject = useCallback(async (projectId: string) => {
    const sequence = (loadSequenceRef.current[projectId] ?? 0) + 1;
    loadSequenceRef.current[projectId] = sequence;
    try {
      const list = isBrowserDevPreview
        ? (browserPreviewChatsByProject[projectId] ?? [])
        : await chatService.listForProject(projectId);
      const visibleChats = list.filter((chat) => chat.messageCount > 0 && !chat.archived);
      if (loadSequenceRef.current[projectId] !== sequence) return;
      setProjectChatsMap((current) =>
        areChatListsEqual(current[projectId], visibleChats) ? current : { ...current, [projectId]: visibleChats },
      );
    } catch {
      if (loadSequenceRef.current[projectId] !== sequence) return;
      setProjectChatsMap((current) => (current[projectId] ? current : { ...current, [projectId]: [] }));
    } finally {
      if (loadSequenceRef.current[projectId] === sequence) {
        setLoadedProjectIds((current) => (current.has(projectId) ? current : new Set(current).add(projectId)));
      }
    }
  }, []);

  const refreshAllChats = useCallback(async () => {
    await Promise.all(projects.map((project) => loadChatsForProject(project.id)));
  }, [loadChatsForProject, projects]);

  useEffect(() => {
    void refreshAllChats();
    const currentProjectIds = new Set(projects.map((project) => project.id));
    setLoadedProjectIds((current) => new Set([...current].filter((id) => currentProjectIds.has(id))));
    setProjectChatsMap((current) =>
      Object.fromEntries(Object.entries(current).filter(([id]) => currentProjectIds.has(id))),
    );
  }, [projects, refreshAllChats]);

  useEffect(() => {
    let refreshTimer: number | null = null;
    const unsubscribe = onChatsUpdated(() => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void refreshAllChats(), 100);
    });
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [refreshAllChats]);

  useEffect(() => {
    if (searchOpen) window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchOpen]);

  useEffect(() => {
    if (!renameDialog) return;
    window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [renameDialog]);

  const projectChats = useMemo<ProjectChat[]>(() => {
    return projects
      .flatMap((project) => (projectChatsMap[project.id] ?? []).map((chat) => ({ project, chat })))
      .sort((a, b) => chatTimestamp(b.chat) - chatTimestamp(a.chat));
  }, [projectChatsMap, projects]);

  const pinnedChats = useMemo(() => projectChats.filter(({ chat }) => chat.pinned), [projectChats]);
  const recentChats = useMemo(() => projectChats.filter(({ chat }) => !chat.pinned), [projectChats]);
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return projectChats.slice(0, 20);
    return projectChats
      .filter(({ project, chat }) =>
        `${chat.title} ${project.name} ${project.path}`.toLocaleLowerCase().includes(query),
      )
      .slice(0, 40);
  }, [projectChats, searchQuery]);

  useEffect(() => {
    setSearchIndex((current) => Math.min(current, Math.max(0, searchResults.length - 1)));
  }, [searchResults.length]);

  const displayedProjects = useMemo(() => {
    if (allProjectsVisible || projects.length <= COLLAPSED_PROJECT_LIMIT) return projects;
    const initial = projects.slice(0, COLLAPSED_PROJECT_LIMIT);
    const activeProject = projects.find((project) => project.id === activeProjectId);
    if (!activeProject || initial.some((project) => project.id === activeProject.id)) return initial;
    return [...initial.slice(0, -1), activeProject];
  }, [activeProjectId, allProjectsVisible, projects]);

  const displayedRecents = allRecentsVisible ? recentChats : recentChats.slice(0, RECENT_CHAT_LIMIT);

  const handleMouseDown = (event: React.MouseEvent) => {
    event.preventDefault();
    setIsResizing(true);
    onResizingChange?.(true);
    const startX = event.clientX;
    const startWidth = localWidth;
    let currentWidth = startWidth;
    let frameId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      currentWidth = clampSidebarWidth(startWidth + moveEvent.clientX - startX);
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(() => {
        setLocalWidth(currentWidth);
        frameId = null;
      });
    };
    const onMouseUp = () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      setLocalWidth(currentWidth);
      setIsResizing(false);
      onResizingChange?.(false);
      onResize(currentWidth);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const toggleProject = useCallback(
    (project: Project) => {
      const willExpand = !expandedProjectIds.has(project.id);
      setExpandedProjectIds((current) => {
        const next = new Set(current);
        if (willExpand) next.add(project.id);
        else next.delete(project.id);
        return next;
      });
      if (project.id !== activeProjectId) void onPickProject(project.id);
      if (willExpand) void loadChatsForProject(project.id);
    },
    [activeProjectId, expandedProjectIds, loadChatsForProject, onPickProject],
  );

  const openProjectMenu = useCallback((event: React.MouseEvent, project: Project) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setProjectMenu({ x: rect.right - 4, y: rect.bottom + 4, project });
  }, []);

  const openChatMenu = useCallback((event: React.MouseEvent, project: Project, chat: ChatSummary) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setChatMenu({ x: rect.right - 4, y: rect.bottom + 4, project, chat });
  }, []);

  const buildProjectMenuItems = (context: ProjectMenuContext): MenuItem[] => [
    {
      label: t("openProjectFolder"),
      icon: <FolderTreeIcon size={14} />,
      onClick: () => void fileService.reveal(context.project.path),
    },
    ...(onEditProject
      ? [{ label: t("editProject"), icon: <PenIcon />, onClick: () => onEditProject(context.project) }]
      : []),
    {},
    {
      label: t("removeFromList"),
      icon: <TrashIcon />,
      danger: true,
      onClick: () => void onRemoveProject(context.project.id),
    },
  ];

  const buildChatMenuItems = (context: ChatMenuContext): MenuItem[] => [
    ...(onRenameChat
      ? [
          {
            label: t("renameSession"),
            onClick: () => setRenameDialog({ project: context.project, chat: context.chat, title: context.chat.title }),
          },
        ]
      : []),
    {
      label: t("copySessionId"),
      onClick: () => void navigator.clipboard.writeText(context.chat.id),
    },
    {},
    {
      label: t("deleteSession"),
      danger: true,
      onClick: () => void onDeleteChat(context.project.id, context.chat.id),
    },
  ];

  const commitRename = useCallback(async () => {
    if (!renameDialog || !onRenameChat) return;
    const title = renameDialog.title.trim();
    if (!title || title === renameDialog.chat.title) {
      setRenameDialog(null);
      return;
    }
    await onRenameChat(renameDialog.project.id, renameDialog.chat.id, title);
    setProjectChatsMap((current) => ({
      ...current,
      [renameDialog.project.id]: (current[renameDialog.project.id] ?? []).map((chat) =>
        chat.id === renameDialog.chat.id ? { ...chat, title, updatedAt: Date.now() } : chat,
      ),
    }));
    setRenameDialog(null);
  }, [onRenameChat, renameDialog]);

  const selectSearchResult = useCallback(
    (result: ProjectChat) => {
      setSearchOpen(false);
      setSearchQuery("");
      void onPickChat(result.project.id, result.chat.id);
    },
    [onPickChat],
  );

  const renderChatRow = (project: Project, chat: ChatSummary, variant: "project" | "recent") => {
    const isActive = project.id === activeProjectId && chat.id === activeChatId;
    return (
      <div
        key={`${variant}-${project.id}-${chat.id}`}
        className={`app-sidebar__chat-row app-sidebar__chat-row--${variant}${isActive ? " app-sidebar__chat-row--active" : ""}`}
        role="button"
        tabIndex={0}
        aria-current={isActive ? "page" : undefined}
        onClick={() => void onPickChat(project.id, chat.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void onPickChat(project.id, chat.id);
          }
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          setChatMenu({ x: event.clientX, y: event.clientY, project, chat });
        }}
      >
        {variant === "project" ? <span className="app-sidebar__chat-leading" aria-hidden="true" /> : null}
        <span className="app-sidebar__chat-title">{chat.title || t("untitledSession")}</span>
        <button
          type="button"
          className="app-sidebar__row-menu"
          onClick={(event) => openChatMenu(event, project, chat)}
          aria-label={t("sessionOptions")}
        >
          <DotsHorizontalIcon size={14} />
        </button>
      </div>
    );
  };

  return (
    <>
      <aside
        className={surfaceClassName(
          "canvas",
          `app-sidebar${open ? " app-sidebar--open" : ""}${isResizing ? " app-sidebar--resizing" : ""}`,
        )}
        style={{ width: open ? `${localWidth}px` : 0, minWidth: open ? `${localWidth}px` : 0 }}
      >
        <div className="app-sidebar__inner" style={{ width: `${localWidth}px` }}>
          <div className="app-sidebar__resize-handle" onMouseDown={handleMouseDown} />

          <nav className="app-sidebar__primary" aria-label={t("sidebarNavigation")}>
            <button
              type="button"
              className="app-sidebar__nav-row"
              onClick={() => void onNewChat(activeProjectId ?? undefined)}
              data-testid="new-conversation-button"
            >
              <NewSessionIcon />
              <span>{t("newConversation")}</span>
            </button>
            <button
              type="button"
              className="app-sidebar__nav-row"
              onClick={() => {
                setSearchIndex(0);
                setSearchOpen(true);
              }}
              data-testid="session-search-button"
            >
              <SearchIcon size={15} />
              <span>{t("searchSessions")}</span>
            </button>
          </nav>

          <div ref={scrollRef} className="app-sidebar__scroll" style={maskStyle}>
            {pinnedChats.length > 0 ? (
              <section className="app-sidebar__section" aria-labelledby="sidebar-pinned-heading">
                <div className="app-sidebar__section-heading" id="sidebar-pinned-heading">
                  {t("pinnedSessions")}
                </div>
                <div className="app-sidebar__section-list">
                  {pinnedChats.map(({ project, chat }) => renderChatRow(project, chat, "recent"))}
                </div>
              </section>
            ) : null}

            <section className="app-sidebar__section" aria-labelledby="sidebar-projects-heading">
              <div className="app-sidebar__section-bar">
                <div className="app-sidebar__section-heading" id="sidebar-projects-heading">
                  {t("projects")}
                </div>
                <Tooltip text={t("addProject")} side="bottom">
                  <button
                    type="button"
                    className="app-sidebar__section-action"
                    onClick={onAddProject}
                    aria-label={t("addProject")}
                  >
                    <PlusSmallIcon size={13} />
                  </button>
                </Tooltip>
              </div>

              <div className="app-sidebar__section-list">
                {displayedProjects.length === 0 ? (
                  <button type="button" className="app-sidebar__empty-action" onClick={onAddProject}>
                    <FolderPlusIcon size={15} />
                    <span>{t("addProject")}</span>
                  </button>
                ) : (
                  displayedProjects.map((project) => {
                    const isActive = project.id === activeProjectId;
                    const isExpanded = expandedProjectIds.has(project.id);
                    const isRemoving = removingIds?.has(project.id) ?? false;
                    const chats = projectChatsMap[project.id] ?? [];
                    const showAllProjectChats = expandedProjectChats.has(project.id);
                    const visibleChats = showAllProjectChats ? chats : chats.slice(0, PROJECT_CHAT_LIMIT);
                    const hasLoaded = loadedProjectIds.has(project.id);

                    return (
                      <div
                        key={project.id}
                        className={`app-sidebar__project${isRemoving ? " app-sidebar__project--removing" : ""}`}
                      >
                        <div
                          className={`app-sidebar__project-row${isActive ? " app-sidebar__project-row--active" : ""}${isExpanded ? " app-sidebar__project-row--expanded" : ""}`}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            setProjectMenu({ x: event.clientX, y: event.clientY, project });
                          }}
                        >
                          <button
                            type="button"
                            className="app-sidebar__project-main"
                            onClick={() => toggleProject(project)}
                            aria-expanded={isExpanded}
                            aria-current={isActive ? "true" : undefined}
                          >
                            <span className="app-sidebar__project-icon" aria-hidden="true">
                              {isExpanded ? <FolderOpenTreeIcon size={16} /> : <FolderTreeIcon size={16} />}
                            </span>
                            <span className="app-sidebar__project-name">{project.name}</span>
                          </button>
                          <div className="app-sidebar__project-actions">
                            <Tooltip text={t("newChatInProject")} side="bottom">
                              <button
                                type="button"
                                className="app-sidebar__row-action"
                                onClick={() => {
                                  setExpandedProjectIds((current) => new Set(current).add(project.id));
                                  void onNewChat(project.id);
                                }}
                                aria-label={t("newChatInProject")}
                              >
                                <PlusSmallIcon size={13} />
                              </button>
                            </Tooltip>
                            <button
                              type="button"
                              className="app-sidebar__row-action"
                              onClick={(event) => openProjectMenu(event, project)}
                              aria-label={t("projectOptions")}
                            >
                              <DotsHorizontalIcon size={14} />
                            </button>
                          </div>
                        </div>

                        <div
                          className={`app-sidebar__project-reveal${isExpanded ? " app-sidebar__project-reveal--open" : ""}`}
                          aria-hidden={!isExpanded}
                        >
                          <div className="app-sidebar__project-reveal-clip">
                            <div className="app-sidebar__project-chats">
                              {!hasLoaded ? (
                                <div className="app-sidebar__project-loading" aria-label={t("loadingSessions")}>
                                  <span />
                                  <span />
                                </div>
                              ) : visibleChats.length === 0 ? (
                                <div className="app-sidebar__project-empty">{t("noSessions")}</div>
                              ) : (
                                <>
                                  {visibleChats.map((chat) => renderChatRow(project, chat, "project"))}
                                  {chats.length > PROJECT_CHAT_LIMIT ? (
                                    <button
                                      type="button"
                                      className="app-sidebar__more-row app-sidebar__more-row--nested"
                                      onClick={() => {
                                        setExpandedProjectChats((current) => {
                                          const next = new Set(current);
                                          if (next.has(project.id)) next.delete(project.id);
                                          else next.add(project.id);
                                          return next;
                                        });
                                      }}
                                    >
                                      {showAllProjectChats
                                        ? t("showLess")
                                        : t("showAllSessions", { count: chats.length })}
                                    </button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {projects.length > COLLAPSED_PROJECT_LIMIT ? (
                  <button
                    type="button"
                    className="app-sidebar__more-row"
                    onClick={() => setAllProjectsVisible((visible) => !visible)}
                  >
                    {allProjectsVisible ? t("showLess") : t("showAllProjects", { count: projects.length })}
                  </button>
                ) : null}
              </div>
            </section>

            <section className="app-sidebar__section" aria-labelledby="sidebar-recents-heading">
              <button
                type="button"
                className="app-sidebar__section-heading app-sidebar__section-heading--toggle"
                id="sidebar-recents-heading"
                aria-expanded={!recentsCollapsed}
                onClick={() => setRecentsCollapsed((collapsed) => !collapsed)}
              >
                <span>{t("recentSessions")}</span>
                <ChevronRightIcon open={!recentsCollapsed} />
              </button>
              {!recentsCollapsed ? (
                <div className="app-sidebar__section-list">
                  {loadedProjectIds.size < projects.length && recentChats.length === 0 ? (
                    <div className="app-sidebar__recents-loading">{t("loadingSessions")}</div>
                  ) : displayedRecents.length === 0 ? (
                    <div className="app-sidebar__recents-empty">{t("noSessions")}</div>
                  ) : (
                    <>
                      {displayedRecents.map(({ project, chat }) => renderChatRow(project, chat, "recent"))}
                      {recentChats.length > RECENT_CHAT_LIMIT ? (
                        <button
                          type="button"
                          className="app-sidebar__more-row"
                          onClick={() => setAllRecentsVisible((visible) => !visible)}
                        >
                          {allRecentsVisible ? t("showLess") : t("showAllSessions", { count: recentChats.length })}
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}
            </section>
          </div>

          <div className="app-sidebar__footer">
            <button
              type="button"
              className="app-sidebar__nav-row"
              onClick={onOpenSettings}
              data-testid="settings-button"
            >
              <SettingsIcon size={15} />
              <span>{t("settings")}</span>
            </button>
          </div>
        </div>
      </aside>

      {searchOpen ? (
        <div
          className="app-sidebar__overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="app-sidebar__search-dialog" role="dialog" aria-modal="true" aria-label={t("searchSessions")}>
            <div className="app-sidebar__search-box">
              <SearchIcon size={16} />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setSearchOpen(false);
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    if (searchResults.length > 0) {
                      setSearchIndex((current) => Math.min(searchResults.length - 1, current + 1));
                    }
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSearchIndex((current) => Math.max(0, current - 1));
                  } else if (event.key === "Enter" && searchResults[searchIndex]) {
                    event.preventDefault();
                    selectSearchResult(searchResults[searchIndex]);
                  }
                }}
                placeholder={t("searchSessionsPlaceholder")}
                aria-label={t("searchSessions")}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="app-sidebar__search-label">
              {searchQuery.trim() ? t("searchResults") : t("recentSessions")}
            </div>
            <div className="app-sidebar__search-results" role="listbox">
              {searchResults.length === 0 ? (
                <div className="app-sidebar__search-empty">{t("noMatchingSessions")}</div>
              ) : (
                searchResults.map((result, index) => (
                  <button
                    type="button"
                    key={`${result.project.id}-${result.chat.id}`}
                    className={`app-sidebar__search-result${index === searchIndex ? " app-sidebar__search-result--active" : ""}`}
                    onMouseEnter={() => setSearchIndex(index)}
                    onClick={() => selectSearchResult(result)}
                    role="option"
                    aria-selected={index === searchIndex}
                  >
                    <span className="app-sidebar__search-result-leading" aria-hidden="true" />
                    <span className="app-sidebar__search-result-copy">
                      <span>{result.chat.title || t("untitledSession")}</span>
                      <small>{result.project.name}</small>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {renameDialog ? (
        <div className="app-sidebar__overlay app-sidebar__overlay--rename" role="presentation">
          <form
            className="app-sidebar__rename-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={t("renameSession")}
            onSubmit={(event) => {
              event.preventDefault();
              void commitRename();
            }}
          >
            <label htmlFor="sidebar-session-title">{t("renameSession")}</label>
            <input
              id="sidebar-session-title"
              ref={renameInputRef}
              value={renameDialog.title}
              onChange={(event) =>
                setRenameDialog((current) => (current ? { ...current, title: event.target.value } : null))
              }
              onKeyDown={(event) => {
                if (event.key === "Escape") setRenameDialog(null);
              }}
            />
            <div className="app-sidebar__rename-actions">
              <button type="button" onClick={() => setRenameDialog(null)}>
                {t("cancel")}
              </button>
              <button type="submit" disabled={!renameDialog.title.trim()}>
                {t("save")}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {projectMenu ? (
        <ContextMenu
          className="app-sidebar-context-menu"
          x={projectMenu.x}
          y={projectMenu.y}
          items={buildProjectMenuItems(projectMenu)}
          onClose={() => setProjectMenu(null)}
        />
      ) : null}
      {chatMenu ? (
        <ContextMenu
          className="app-sidebar-context-menu"
          x={chatMenu.x}
          y={chatMenu.y}
          items={buildChatMenuItems(chatMenu)}
          onClose={() => setChatMenu(null)}
        />
      ) : null}
    </>
  );
}
