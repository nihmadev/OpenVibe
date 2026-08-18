import { surfaceClassName } from "@zazaru/ui";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContextMenu, type MenuItem } from "@/base/browser/ui/contextMenu/contextMenu";
import {
  AlertCircleIcon,
  DotsHorizontalIcon,
  FilterListIcon,
  FolderOpenTreeIcon,
  FolderPlusIcon,
  FolderTreeIcon,
  HistoryClockIcon,
  NewSessionIcon,
  PlusSmallIcon,
  ScheduleCalendarIcon,
  SettingsIcon,
  TrashIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useScrollMask } from "@/base/browser/ui/useScrollMask";
import { useI18n } from "@/platform/localization/localizationService";
import {
  type DisplayOptions,
  DisplayOptionsDropdown,
} from "@/workbench/browser/parts/sidebar/displayOptions/displayOptionsDropdown";
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
  activeView?: "chat" | "history" | "scheduled";
  onOpenHistory?: () => void;
  onOpenScheduled?: () => void;
  onPickProject: (id: string) => void;
  onAddProject: () => void;
  onCloseProject: () => void;
  onRemoveProject: (id: string) => void;
  onEditProject?: (project: Project) => void;
  onPickChat: (projectId: string | null, chatId: string) => void;
  onNewChat: (projectId?: string) => void;
  onDeleteChat: (chatId: string) => void;
  onOpenSettings: () => void;
  removingIds?: Set<string>;
}

const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 520;
const SIDEBAR_CONTENT_RESERVE = 320;

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
      chat.unreadAt === candidate.unreadAt
    );
  });
}

interface ProjectMenuCtx {
  x: number;
  y: number;
  project: Project;
}

interface ChatMenuCtx {
  x: number;
  y: number;
  chatId: string;
  projectId: string;
}

function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w`;
  return `${days}d`;
}

export function SidebarView({
  open,
  width,
  onResize,
  onResizingChange,
  projects,
  activeProjectId,
  activeChatId,
  activeView = "chat",
  onOpenHistory,
  onOpenScheduled,
  onPickProject,
  onAddProject,
  onCloseProject,
  onRemoveProject,
  onEditProject,
  onPickChat,
  onNewChat,
  onDeleteChat,
  onOpenSettings,
  removingIds,
}: SidebarViewProps): React.ReactElement {
  const { t } = useI18n();
  const [localWidth, setLocalWidth] = useState(() => clampSidebarWidth(width));
  const [isResizing, setIsResizing] = useState(false);
  const [projectCtx, setProjectCtx] = useState<ProjectMenuCtx | null>(null);
  const [chatCtx, setChatCtx] = useState<ChatMenuCtx | null>(null);
  const [displayDropdownOpen, setDisplayDropdownOpen] = useState(false);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => new Set());
  const [displayOptions, setDisplayOptions] = useState<DisplayOptions>({
    groupBy: "project",
    sortBy: "last_updated",
    showSubtitles: true,
    showArchived: false,
  });

  // Show all chats state per project (limit to 5 by default)
  const [showAllProjectsMap, setShowAllProjectsMap] = useState<Record<string, boolean>>({});

  // Cached project chats map: projectId -> ChatSummary[]
  const [projectChatsMap, setProjectChatsMap] = useState<Record<string, ChatSummary[]>>({});
  const chatLoadSequenceRef = useRef<Record<string, number>>({});

  const { ref: treeScrollRef, maskStyle: treeMaskStyle } = useScrollMask<HTMLDivElement>();

  // Keep local width in sync with prop

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(clampSidebarWidth(width));
    }
  }, [width, isResizing]);

  // Function to load chats for a specific project
  const loadChatsForProject = useCallback(async (projectId: string) => {
    const sequence = (chatLoadSequenceRef.current[projectId] ?? 0) + 1;
    chatLoadSequenceRef.current[projectId] = sequence;
    try {
      const list = await chatService.listForProject(projectId);
      const filtered = list.filter((c) => c.messageCount > 0);
      if (chatLoadSequenceRef.current[projectId] !== sequence) return filtered;
      setProjectChatsMap((prev) => {
        if (areChatListsEqual(prev[projectId], filtered)) return prev;
        return {
          ...prev,
          [projectId]: filtered,
        };
      });
      return filtered;
    } catch {
      return [];
    }
  }, []);

  const expandProject = useCallback((projectId: string) => {
    setExpandedProjectIds((previous) => {
      if (previous.has(projectId)) return previous;
      const next = new Set(previous);
      next.add(projectId);
      return next;
    });
  }, []);

  // An externally selected project opens without collapsing projects the user
  // already expanded. Only the selected project is refreshed over IPC.
  useEffect(() => {
    if (!activeProjectId) return;
    expandProject(activeProjectId);
    void loadChatsForProject(activeProjectId);
  }, [activeProjectId, expandProject, loadChatsForProject]);

  // Reload chats when backend notifies of updates
  useEffect(() => {
    let refreshTimer: number | null = null;
    const unsub = onChatsUpdated(() => {
      if (!activeProjectId) return;
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        void loadChatsForProject(activeProjectId);
      }, 100);
    });
    return () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      unsub();
    };
  }, [activeProjectId, loadChatsForProject]);

  const handleProjectActivate = useCallback(
    (projectId: string) => {
      if (projectId === activeProjectId) {
        const willExpand = !expandedProjectIds.has(projectId);
        setExpandedProjectIds((previous) => {
          const next = new Set(previous);
          if (willExpand) next.add(projectId);
          else next.delete(projectId);
          return next;
        });
        if (willExpand) void loadChatsForProject(projectId);
        return;
      }

      expandProject(projectId);
      onPickProject(projectId);
    },
    [activeProjectId, expandProject, expandedProjectIds, loadChatsForProject, onPickProject],
  );

  // Resize handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    onResizingChange?.(true);
    const startX = e.clientX;
    const startWidth = width;

    let currentWidth = startWidth;
    let frameId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      currentWidth = clampSidebarWidth(startWidth + delta);

      if (frameId !== null) return;
      frameId = requestAnimationFrame(() => {
        setLocalWidth(currentWidth);
        frameId = null;
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      onResizingChange?.(false);
      onResize(currentWidth);
      if (frameId !== null) cancelAnimationFrame(frameId);
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

  // Project context menu items
  const buildProjectMenuItems = (c: ProjectMenuCtx): MenuItem[] => {
    const isActive = c.project.id === activeProjectId;
    return [
      ...(onEditProject
        ? [
            {
              label: t("editProject"),
              onClick: () => onEditProject(c.project),
            },
          ]
        : []),
      {
        label: t("openProjectFolder"),
        onClick: () => fileService.reveal(c.project.path),
      },
      {
        label: t("copyProjectPath"),
        onClick: () => navigator.clipboard.writeText(c.project.path),
      },
      ...(isActive
        ? [
            {
              label: t("closeProject"),
              onClick: () => onCloseProject(),
            },
          ]
        : []),
      {
        label: t("removeFromList"),
        danger: true,
        onClick: () => onRemoveProject(c.project.id),
      },
    ];
  };

  const buildChatMenuItems = (c: ChatMenuCtx): MenuItem[] => {
    return [
      {
        label: t("copyId" as any) || "Copy ID",
        onClick: () => navigator.clipboard.writeText(c.chatId),
      },
      {
        label: t("deleteSession"),
        danger: true,
        onClick: () => onDeleteChat(c.chatId),
      },
    ];
  };

  const sortedProjects = useMemo(() => {
    const list = [...projects];
    if (displayOptions.sortBy === "alphabetical") {
      return list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [projects, displayOptions.sortBy]);

  return (
    <>
      <aside
        className={surfaceClassName(
          "canvas",
          `app-sidebar${open ? " app-sidebar--open" : ""}${isResizing ? " app-sidebar--resizing" : ""}`,
        )}
        style={{
          width: open ? `${localWidth}px` : "0px",
          minWidth: open ? `${localWidth}px` : "0px",
        }}
      >
        <div className="app-sidebar__inner" style={{ width: `${localWidth}px` }}>
          <div className="app-sidebar__resize-handle" onMouseDown={handleMouseDown} />

          {/* ── Top Navigation Actions ── */}
          <div className="app-sidebar__top-actions">
            <button
              type="button"
              className="app-sidebar__btn app-sidebar__btn--new"
              onClick={() => onNewChat(activeProjectId ?? undefined)}
              data-testid="new-conversation-button"
            >
              <NewSessionIcon />
              <span className="app-sidebar__btn-label">{t("newConversation")}</span>
              <span className="app-sidebar__new-affordance" aria-hidden="true">
                <PlusSmallIcon size={12} />
              </span>
            </button>

            <button
              type="button"
              className={`app-sidebar__btn${activeView === "history" ? " app-sidebar__btn--active" : ""}`}
              onClick={onOpenHistory}
              data-testid="history-button"
            >
              <HistoryClockIcon size={16} className="app-sidebar__btn-icon" />
              <span className="app-sidebar__btn-label">{t("conversationHistory")}</span>
            </button>

            <button
              type="button"
              className={`app-sidebar__btn${activeView === "scheduled" ? " app-sidebar__btn--active" : ""}`}
              onClick={onOpenScheduled}
              data-testid="scheduled-button"
            >
              <ScheduleCalendarIcon size={16} className="app-sidebar__btn-icon" />
              <span className="app-sidebar__btn-label">{t("scheduledTasks")}</span>
            </button>
          </div>

          {/* ── Projects Tree (Accordion with Direct Nested Chats) ── */}
          <div className="app-sidebar__projects-section">
            <div className="app-sidebar__section-header">
              <span className="app-sidebar__section-title">{t("projects")}</span>
              <div className="app-sidebar__section-tools" style={{ position: "relative" }}>
                <Tooltip text={t("filterProjects")} side="bottom">
                  <button
                    type="button"
                    className="app-sidebar__icon-btn"
                    onClick={() => setDisplayDropdownOpen((v) => !v)}
                    aria-label={t("filterProjects")}
                  >
                    <FilterListIcon size={14} />
                  </button>
                </Tooltip>
                <DisplayOptionsDropdown
                  isOpen={displayDropdownOpen}
                  onClose={() => setDisplayDropdownOpen(false)}
                  options={displayOptions}
                  onChange={setDisplayOptions}
                  align="left"
                />
                <Tooltip text={t("addProject")} side="bottom">
                  <button
                    type="button"
                    className="app-sidebar__icon-btn"
                    onClick={onAddProject}
                    aria-label={t("addProject")}
                  >
                    <FolderPlusIcon size={15} />
                  </button>
                </Tooltip>
              </div>
            </div>

            <div ref={treeScrollRef} className="app-sidebar__tree" style={treeMaskStyle}>
              {sortedProjects.length === 0 ? (
                <div className="app-sidebar__empty-projects">
                  <span>{t("noProjects")}</span>
                  <button type="button" className="app-sidebar__empty-add-btn" onClick={onAddProject}>
                    <FolderPlusIcon size={14} />
                    <span>{t("addProject")}</span>
                  </button>
                </div>
              ) : (
                sortedProjects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  const isRemoving = removingIds?.has(p.id) ?? false;
                  const chatsForThisProj = projectChatsMap[p.id] ?? [];
                  const showProjectChildren = expandedProjectIds.has(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`app-sidebar__project-node${isRemoving ? " app-sidebar__project-node--removing" : ""}`}
                    >
                      {/* Project Header Row */}
                      <div
                        className={`app-sidebar__project-header${isActive ? " app-sidebar__project-header--active" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-current={isActive ? "true" : undefined}
                        aria-expanded={showProjectChildren}
                        onClick={() => handleProjectActivate(p.id)}
                        onKeyDown={(e) => {
                          if (e.target !== e.currentTarget) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleProjectActivate(p.id);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setProjectCtx({ x: e.clientX, y: e.clientY, project: p });
                        }}
                      >
                        <div className="app-sidebar__project-left">
                          <span className="app-sidebar__project-icon">
                            {showProjectChildren ? <FolderOpenTreeIcon size={15} /> : <FolderTreeIcon size={15} />}
                          </span>
                          <span className="app-sidebar__project-name">{p.name}</span>
                        </div>

                        {/* Project Actions on Hover */}
                        <div className="app-sidebar__project-actions" onClick={(e) => e.stopPropagation()}>
                          <Tooltip text={t("newChatInProject")} side="bottom">
                            <button
                              type="button"
                              className="app-sidebar__project-action"
                              onClick={(e) => {
                                e.stopPropagation();
                                expandProject(p.id);
                                if (p.id !== activeProjectId) {
                                  onPickProject(p.id);
                                }
                                onNewChat(p.id);
                              }}
                              aria-label={t("newChatInProject")}
                            >
                              <PlusSmallIcon />
                            </button>
                          </Tooltip>

                          <button
                            type="button"
                            className="app-sidebar__project-action"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setProjectCtx({ x: rect.right, y: rect.bottom + 4, project: p });
                            }}
                            aria-label="Project Options"
                          >
                            <DotsHorizontalIcon size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Nested Project Chats (Directly Indented) */}
                      <div
                        className={`app-sidebar__nested-reveal${showProjectChildren ? " app-sidebar__nested-reveal--open" : ""}`}
                        aria-hidden={!showProjectChildren}
                      >
                        <div className="app-sidebar__nested-clip">
                          <div className="app-sidebar__nested-chats">
                            {chatsForThisProj.length === 0 ? (
                              <div className="app-sidebar__chat-empty">
                                <span>{t("noSessions")}</span>
                                {isActive ? (
                                  <button
                                    type="button"
                                    className="app-sidebar__chat-start-btn"
                                    onClick={() => onNewChat(p.id)}
                                  >
                                    {t("newSession")}
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <>
                                {(showAllProjectsMap[p.id] ? chatsForThisProj : chatsForThisProj.slice(0, 5)).map(
                                  (c) => {
                                    const isChatActive = c.id === activeChatId && isActive;
                                    const time = c.updatedAt || c.createdAt || 0;
                                    const status = c.status || "idle";
                                    return (
                                      <div
                                        key={c.id}
                                        className={`app-sidebar__chat-row${isChatActive ? " app-sidebar__chat-row--active" : ""}${c.unreadAt ? " app-sidebar__chat-row--unread" : ""}`}
                                        role="button"
                                        tabIndex={0}
                                        aria-current={isChatActive ? "page" : undefined}
                                        onClick={() => onPickChat(p.id, c.id)}
                                        onKeyDown={(e) => {
                                          if (e.target !== e.currentTarget) return;
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            onPickChat(p.id, c.id);
                                          }
                                        }}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          setChatCtx({ x: e.clientX, y: e.clientY, chatId: c.id, projectId: p.id });
                                        }}
                                      >
                                        <div className="app-sidebar__chat-left">
                                          {status === "error" ? (
                                            <AlertCircleIcon
                                              size={13}
                                              className="app-sidebar__chat-status app-sidebar__chat-status--error"
                                            />
                                          ) : status === "running" ? (
                                            <span
                                              className="app-sidebar__chat-status app-sidebar__chat-status-spinner"
                                              title="Running"
                                            />
                                          ) : null}
                                          <span className="app-sidebar__chat-title" title={c.title || ""}>
                                            {c.title || t("untitledSession" as any) || "Untitled"}
                                          </span>
                                        </div>

                                        {/* Default: timestamp is shown */}
                                        {time > 0 && (
                                          <span className="app-sidebar__chat-time">{formatRelativeTime(time)}</span>
                                        )}

                                        {/* Hover: actions appear smoothly replacing timestamp */}
                                        <div className="app-sidebar__chat-actions" onClick={(e) => e.stopPropagation()}>
                                          <Tooltip text={t("deleteSession")} side="bottom">
                                            <button
                                              type="button"
                                              className="app-sidebar__chat-action-btn app-sidebar__chat-action-btn--delete"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteChat(c.id);
                                              }}
                                              aria-label={t("deleteSession")}
                                            >
                                              <TrashIcon />
                                            </button>
                                          </Tooltip>
                                        </div>
                                      </div>
                                    );
                                  },
                                )}

                                {chatsForThisProj.length > 5 && (
                                  <button
                                    type="button"
                                    className="app-sidebar__show-more-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAllProjectsMap((prev) => ({
                                        ...prev,
                                        [p.id]: !prev[p.id],
                                      }));
                                    }}
                                  >
                                    <span>
                                      {showAllProjectsMap[p.id]
                                        ? t("showLess" as any) || "Show less"
                                        : `${t("showAll" as any) || "Show all"} (${chatsForThisProj.length})`}
                                    </span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Bottom Section (Settings) ── */}
          <div className="app-sidebar__bottom">
            <button type="button" className="app-sidebar__btn" onClick={onOpenSettings} data-testid="settings-button">
              <SettingsIcon size={16} className="app-sidebar__btn-icon" />
              <span className="app-sidebar__btn-label">{t("settings")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Project Context Menu */}
      {projectCtx ? (
        <ContextMenu
          x={projectCtx.x}
          y={projectCtx.y}
          items={buildProjectMenuItems(projectCtx)}
          onClose={() => setProjectCtx(null)}
        />
      ) : null}

      {/* Chat Context Menu */}
      {chatCtx ? (
        <ContextMenu x={chatCtx.x} y={chatCtx.y} items={buildChatMenuItems(chatCtx)} onClose={() => setChatCtx(null)} />
      ) : null}
    </>
  );
}
