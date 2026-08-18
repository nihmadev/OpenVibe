import { surfaceClassName } from "@zazaru/ui";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FolderTreeIcon,
  GitBranchIcon,
  GlobeIcon,
  RightSidebarToggleIcon,
  SearchInCodeIcon,
  TerminalIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import { useAnimations } from "@/platform/configuration/browser/animationService";
import { useI18n } from "@/platform/localization/localizationService";
import { EditorArea } from "@/workbench/browser/parts/editor/editor/editorArea";
import { SidebarView } from "@/workbench/browser/parts/sidebar/sidebarView";
import type { HistoryItem } from "@/workbench/common/conversation";
import type { BrowserViewProps } from "@/workbench/contrib/browser/common/browser";
import type {
  ChatViewProps,
  ComposerProps,
  ConversationHistoryViewProps,
  EmptyWorkspaceViewProps,
  SubAgentViewProps,
  TodoViewProps,
} from "@/workbench/contrib/chat/common/chat";
import type { ExplorerViewProps } from "@/workbench/contrib/explorer/common/explorer";
import type { ScheduledTasksViewProps } from "@/workbench/contrib/scheduledTasks/common/scheduledTask";
import type { ScmViewProps } from "@/workbench/contrib/scm/common/scm";
import type { SearchViewProps } from "@/workbench/contrib/search/common/search";
import type { TerminalViewProps } from "@/workbench/contrib/terminal/common/terminal";
import type { EditWorkspaceDialogProps } from "@/workbench/contrib/workspaces/common/workspaces";
import { useRegenerate } from "@/workbench/services/agent/browser/useRegenerate";
import { useRollback } from "@/workbench/services/agent/browser/useRollback";
import { useSubAgentDrilldown } from "@/workbench/services/agent/browser/useSubAgentDrilldown";
import { currentRunFileChangeSummary, currentTodoTasks } from "@/workbench/services/agent/common/agentRun";
import type { SendPayload } from "@/workbench/services/agent/common/sendPayload";
import type { VibeConfig } from "@/workbench/services/aiProviders/common/aiProvider";
import { hydrateRestoredMentions, recordToItems } from "@/workbench/services/chat/browser/chatHistory";
import type { ChatRecord, ChatSummary } from "@/workbench/services/chat/common/chat";
import { chatService } from "@/workbench/services/chat/tauri/chatService";
import { useProjectEdit } from "@/workbench/services/workspace/browser/useWorkspaceEdit";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import {
  type WorkspaceRightNewTabItem,
  WorkspaceRightPanel,
  type WorkspaceRightTab,
  type WorkspaceRightTabId,
} from "./parts/auxiliaryBar/auxiliaryBar";
import { ResizeHandle } from "./parts/auxiliaryBar/resizeHandle";

const RIGHT_PANEL_WIDTH_KEY = "openvibe:right-panel-width:v3";

function initialRightPanelWidth(): number {
  if (typeof window === "undefined") return 600;
  const stored = Number.parseFloat(window.localStorage.getItem(RIGHT_PANEL_WIDTH_KEY) ?? "");
  if (Number.isFinite(stored)) return Math.max(320, stored);
  return Math.max(320, Math.min(600, window.innerHeight * 1.6, window.innerWidth - 352));
}

type ChatChangeCallback = (record: ChatRecord | null) => void | Promise<void>;
type ProjectChangeCallback = (folder: string | null, projectId: string | null) => Promise<void>;

export interface WorkbenchContributions {
  ChatView: React.ComponentType<ChatViewProps>;
  Composer: React.ComponentType<ComposerProps>;
  EmptyWorkspaceView: React.ComponentType<EmptyWorkspaceViewProps>;
  SubAgentView: React.ComponentType<SubAgentViewProps>;
  TodoView: React.ComponentType<TodoViewProps>;
  ConversationHistoryView: React.ComponentType<ConversationHistoryViewProps>;
  ScheduledTasksView: React.ComponentType<ScheduledTasksViewProps>;
  ExplorerView: React.ComponentType<ExplorerViewProps>;
  SearchView: React.ComponentType<SearchViewProps>;
  ScmView: React.ComponentType<ScmViewProps>;
  TerminalView: React.ComponentType<TerminalViewProps>;
  BrowserView: React.ComponentType<BrowserViewProps>;
  EditWorkspaceDialog: React.ComponentType<EditWorkspaceDialogProps>;
}

interface WorkbenchProps {
  contributions: WorkbenchContributions;
  projects: Project[];
  activeProject: string | null;
  chatSideOpen: boolean;
  setChatSideOpen?: (open: boolean) => void;
  chatSideSticky?: boolean;
  setChatSideSticky?: (sticky: boolean) => void;
  handlePickProject: (id: string, cb: ProjectChangeCallback) => void;
  handleHoverProject?: (id: string | null) => void;
  hoveredProject?: Project | null;
  hoveredChats?: ChatSummary[];
  handleAddProject: (cb: ProjectChangeCallback) => void;
  handleCloseProject: () => void;
  handleRemoveProject: (id: string, cb: ProjectChangeCallback) => void;
  onProjectChange: ProjectChangeCallback;
  setSettingsOpen: (open: boolean) => void;
  onOpenSettings?: (tab?: string) => void;
  sidebarWidth: number;
  handleSidebarResize: (width: number) => void;
  activeChat: string | null;
  folder: string | null;
  config: VibeConfig;
  handlePickChat: (id: string, cb: ChatChangeCallback) => void;
  handleNewChat: (cb: ChatChangeCallback) => void;
  handleCloseChat: (id: string, cb: ChatChangeCallback) => void;
  items: HistoryItem[];
  streamingNow: string | null;
  busy: boolean;
  handlePickModel: (model: string, providerDbId?: string) => void;
  handleSubmit: (payload: SendPayload) => void;
  onStop: () => void;
  reasoningEffort?: string;
  onReasoningEffortChange?: (effort: string | null) => void;
  terminalOpen: boolean;
  browserOpen: boolean;
  fileTreeOpen: boolean;
  gitPanelOpen?: boolean;
  openFiles: string[];
  activeFile: string | null;
  previewFile: string | null;
  handleOpenFile: (path: string, line?: number, column?: number) => void;
  handleCloseFile: (path: string) => void;
  handleActivateFile: (path: string) => void;
  onPinFile: (path: string) => void;
  setItems: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  revealPath?: string | null;
  setProjects?: (projects: Project[]) => void;
  searchInCodeOpen?: boolean;
  onCloseSearchInCode?: () => void;
  onCloseGitPanel?: () => void;
  onToggleFileTree?: () => void;
  onToggleSearchInCode?: () => void;
  onToggleGitPanel?: () => void;
  onToggleTerminal?: () => void;
  onToggleBrowser?: () => void;
  gotoLine?: number;
  gotoColumn?: number;
  gotoMatchLength?: number;
  removingIds?: Set<string>;
}

export function Workbench({
  contributions,
  projects,
  activeProject,
  chatSideOpen,
  handlePickProject,
  handleAddProject,
  handleCloseProject,
  handleRemoveProject,
  onProjectChange,
  setSettingsOpen,
  onOpenSettings,
  sidebarWidth,
  handleSidebarResize,
  activeChat,
  folder,
  config,
  handlePickChat,
  handleNewChat,
  handleCloseChat,
  items,
  streamingNow,
  busy,
  handlePickModel,
  handleSubmit,
  onStop,
  reasoningEffort,
  onReasoningEffortChange,
  terminalOpen,
  browserOpen,
  openFiles,
  activeFile,
  previewFile,
  handleOpenFile,
  handleCloseFile,
  handleActivateFile,
  onPinFile,
  setItems,
  fileTreeOpen,
  gitPanelOpen = false,
  revealPath,
  setProjects,
  searchInCodeOpen = false,
  onCloseSearchInCode = () => {},
  onCloseGitPanel = () => {},
  onToggleFileTree = () => {},
  onToggleSearchInCode = () => {},
  onToggleGitPanel = () => {},
  onToggleTerminal = () => {},
  onToggleBrowser = () => {},
  gotoLine,
  gotoColumn,
  gotoMatchLength,
  removingIds,
}: WorkbenchProps) {
  const {
    ChatView,
    Composer,
    EmptyWorkspaceView,
    SubAgentView,
    TodoView,
    ConversationHistoryView,
    ScheduledTasksView,
    ExplorerView,
    SearchView,
    ScmView,
    TerminalView,
    BrowserView,
    EditWorkspaceDialog,
  } = contributions;
  const { t } = useI18n();
  const { settings: animationSettings } = useAnimations();
  const cwd = folder ?? config.cwd;
  const todoTasks = useMemo(() => currentTodoTasks(items), [items]);
  const todoChangeSummary = useMemo(() => currentRunFileChangeSummary(items), [items]);
  const activeProjectName = useMemo(
    () =>
      projects.find((project) => project.id === activeProject)?.name ??
      cwd.split(/[\\/]/).filter(Boolean).at(-1) ??
      "OpenVibe",
    [activeProject, cwd, projects],
  );
  const [starterDraft, setStarterDraft] = useState({ text: "", revision: 0 });

  // Keep chat and editor balanced until the user explicitly resizes them.
  // A fixed 320px initial chat width made the first opened editor consume most
  // of a wide window. Once resized, the chosen pixel width is kept as before.
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(initialRightPanelWidth);
  const [activeRightPanelTab, setActiveRightPanelTab] = useState<WorkspaceRightTabId>("files");
  const [rightPanelVisible, setRightPanelVisible] = useState(
    fileTreeOpen || searchInCodeOpen || gitPanelOpen || terminalOpen || browserOpen,
  );
  const [rightPanelExpanded, setRightPanelExpanded] = useState(false);

  // Refs for direct DOM manipulation during resize (avoids React re-renders on every mousemove)
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const previousRightPanelOpenRef = useRef<Record<WorkspaceRightTabId, boolean>>({
    files: false,
    search: false,
    git: false,
    terminal: false,
    browser: false,
  });

  const rightPanelOpenState = useMemo<Record<WorkspaceRightTabId, boolean>>(
    () => ({
      files: fileTreeOpen,
      search: searchInCodeOpen,
      git: gitPanelOpen,
      terminal: terminalOpen,
      browser: browserOpen,
    }),
    [browserOpen, fileTreeOpen, gitPanelOpen, searchInCodeOpen, terminalOpen],
  );
  const rightPanelHasTabs = Object.values(rightPanelOpenState).some(Boolean);
  const rightPanelOpen = rightPanelVisible;

  useEffect(() => {
    window.localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(rightPanelWidth));
  }, [rightPanelWidth]);

  useEffect(() => {
    const previous = previousRightPanelOpenRef.current;
    const newlyOpened = (Object.keys(rightPanelOpenState) as WorkspaceRightTabId[]).find(
      (tab) => rightPanelOpenState[tab] && !previous[tab],
    );
    if (newlyOpened) {
      setActiveRightPanelTab(newlyOpened);
      setRightPanelVisible(true);
    }
    previousRightPanelOpenRef.current = rightPanelOpenState;

    if (rightPanelHasTabs && !rightPanelOpenState[activeRightPanelTab]) {
      const fallback = (Object.keys(rightPanelOpenState) as WorkspaceRightTabId[]).find(
        (tab) => rightPanelOpenState[tab],
      );
      if (fallback) setActiveRightPanelTab(fallback);
    }
  }, [activeRightPanelTab, rightPanelHasTabs, rightPanelOpenState]);

  const toggleRightPanelVisibility = useCallback(() => {
    setRightPanelVisible((visible) => {
      if (visible) setRightPanelExpanded(false);
      return !visible;
    });
  }, []);

  const openRightPanelTab = useCallback(
    (tab: WorkspaceRightTabId) => {
      if (tab === "files" && !fileTreeOpen) onToggleFileTree();
      if (tab === "search" && !searchInCodeOpen) onToggleSearchInCode();
      if (tab === "git" && !gitPanelOpen) onToggleGitPanel();
      if (tab === "terminal" && !terminalOpen) onToggleTerminal();
      if (tab === "browser" && !browserOpen) onToggleBrowser();
      setActiveRightPanelTab(tab);
      setRightPanelVisible(true);
    },
    [
      fileTreeOpen,
      browserOpen,
      gitPanelOpen,
      onToggleFileTree,
      onToggleGitPanel,
      onToggleSearchInCode,
      onToggleTerminal,
      onToggleBrowser,
      searchInCodeOpen,
      terminalOpen,
    ],
  );

  const closeRightPanelTab = useCallback(
    (tab: WorkspaceRightTabId) => {
      if (tab === "files" && fileTreeOpen) onToggleFileTree();
      if (tab === "search" && searchInCodeOpen) onCloseSearchInCode();
      if (tab === "git" && gitPanelOpen) onCloseGitPanel();
      if (tab === "terminal" && terminalOpen) onToggleTerminal();
      if (tab === "browser" && browserOpen) onToggleBrowser();
    },
    [
      fileTreeOpen,
      browserOpen,
      gitPanelOpen,
      onCloseGitPanel,
      onCloseSearchInCode,
      onToggleFileTree,
      onToggleTerminal,
      onToggleBrowser,
      searchInCodeOpen,
      terminalOpen,
    ],
  );

  const rightPanelTabs = useMemo<WorkspaceRightTab[]>(() => {
    const tabs: WorkspaceRightTab[] = [];
    if (fileTreeOpen) tabs.push({ id: "files", label: t("filesTitle"), icon: <FolderTreeIcon size={16} /> });
    if (searchInCodeOpen) tabs.push({ id: "search", label: t("searchTitle"), icon: <SearchInCodeIcon size={16} /> });
    if (gitPanelOpen) tabs.push({ id: "git", label: t("gitTitle"), icon: <GitBranchIcon size={16} /> });
    if (terminalOpen) tabs.push({ id: "terminal", label: t("terminalTitle"), icon: <TerminalIcon size={16} /> });
    if (browserOpen) tabs.push({ id: "browser", label: t("browserTitle"), icon: <GlobeIcon size={16} /> });
    return tabs;
  }, [browserOpen, fileTreeOpen, gitPanelOpen, searchInCodeOpen, t, terminalOpen]);

  const rightPanelNewTabItems = useMemo<WorkspaceRightNewTabItem[]>(
    () => [
      { id: "files", label: t("filesTitle"), icon: <FolderTreeIcon size={16} />, shortcut: "Ctrl+Shift+E" },
      { id: "search", label: t("searchTitle"), icon: <SearchInCodeIcon size={16} />, shortcut: "Ctrl+Shift+F" },
      { id: "git", label: t("gitTitle"), icon: <GitBranchIcon size={16} /> },
      { id: "terminal", label: t("terminalTitle"), icon: <TerminalIcon size={16} />, shortcut: "Ctrl+`" },
      { id: "browser", label: t("browserTitle"), icon: <GlobeIcon size={16} /> },
    ],
    [t],
  );

  // dirty files set - tracked here so EditorArea tabs can show the dot
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const handleDirtyChange = useCallback(
    (path: string, dirty: boolean) => {
      setDirtyFiles((prev) => {
        const next = new Set(prev);
        if (dirty) next.add(path);
        else next.delete(path);
        return next;
      });
      if (dirty) onPinFile(path);
    },
    [onPinFile],
  );

  const { rollbackIndex, rollbackText, rollbackChanged, rollbackRemoved, clearRollback, revertToItem, undoRollback } =
    useRollback(setItems);

  useEffect(() => {
    clearRollback();
  }, [clearRollback]);

  const { drillDownId, drillItems, drillDown, drillBack } = useSubAgentDrilldown(items);

  const handleRevert = useCallback(
    (id: string) => {
      if (busy) return;
      revertToItem(items, id);
    },
    [busy, items, revertToItem],
  );

  const regenerate = useRegenerate(items, setItems, handleSubmit);
  const handleRegenerate = useCallback(
    (id: string) => {
      if (busy) return;
      regenerate(id);
    },
    [busy, regenerate],
  );

  const handleOpenAgentDiff = useCallback(
    (toolCallId: string, path: string) => {
      const absolutePath =
        !path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path)
          ? `${cwd.replace(/[\\/]$/, "")}/${path.replace(/\\/g, "/")}`
          : path;
      handleOpenFile(
        `agent-diff:?toolCallId=${encodeURIComponent(toolCallId)}&path=${encodeURIComponent(absolutePath)}`,
      );
    },
    [cwd, handleOpenFile],
  );

  const applyChatRecord = useCallback(
    async (record: ChatRecord | null) => {
      setItems(record ? await hydrateRestoredMentions(recordToItems(record), cwd) : []);
    },
    [setItems, cwd],
  );

  const [activeView, setActiveView] = useState<"chat" | "history" | "scheduled">("chat");

  const { editingProject, startEdit, cancelEdit, completeEdit } = useProjectEdit(setProjects);

  const getAllProjectChats = useCallback(async () => {
    const results: Array<{ project: Project | null; chat: ChatSummary }> = [];
    for (const p of projects) {
      try {
        const pChats = await chatService.listForProject(p.id);
        pChats
          .filter((c) => c.messageCount > 0)
          .forEach((chat) => {
            results.push({ project: p, chat });
          });
      } catch {
        /* ignore */
      }
    }
    return results.sort(
      (a, b) => (b.chat.updatedAt || b.chat.createdAt || 0) - (a.chat.updatedAt || a.chat.createdAt || 0),
    );
  }, [projects]);

  const handleProjectRemove = useCallback(
    (id: string) => {
      handleRemoveProject(id, onProjectChange);
    },
    [handleRemoveProject, onProjectChange],
  );

  const handlePickChatFromSidebar = useCallback(
    async (projectId: string | null, chatId: string) => {
      setActiveView("chat");
      if (projectId && projectId !== activeProject) {
        await handlePickProject(projectId, async (newFolder, pId) => {
          await onProjectChange(newFolder, pId);
          handlePickChat(chatId, applyChatRecord);
        });
      } else {
        handlePickChat(chatId, applyChatRecord);
      }
    },
    [activeProject, handlePickProject, onProjectChange, handlePickChat, applyChatRecord],
  );

  const handleNewChatInProject = useCallback(
    async (projectId?: string) => {
      setActiveView("chat");
      if (projectId && projectId !== activeProject) {
        await handlePickProject(projectId, async (newFolder, pId) => {
          await onProjectChange(newFolder, pId);
          handleNewChat(() => setItems([]));
        });
      } else {
        handleNewChat(() => setItems([]));
      }
    },
    [activeProject, handlePickProject, onProjectChange, handleNewChat, setItems],
  );

  return (
    <div className="app__body">
      {/* Unified left sidebar (Antigravity 2.0 style) */}
      <SidebarView
        open={chatSideOpen}
        width={sidebarWidth}
        onResize={handleSidebarResize}
        projects={projects}
        activeProjectId={activeProject}
        activeChatId={activeChat}
        activeView={activeView}
        onOpenHistory={() => setActiveView("history")}
        onOpenScheduled={() => setActiveView("scheduled")}
        onPickProject={(id) => handlePickProject(id, onProjectChange)}
        onAddProject={() => handleAddProject(onProjectChange)}
        onCloseProject={handleCloseProject}
        onRemoveProject={handleProjectRemove}
        onEditProject={startEdit}
        onPickChat={handlePickChatFromSidebar}
        onNewChat={handleNewChatInProject}
        onDeleteChat={(id) => handleCloseChat(id, applyChatRecord)}
        onOpenSettings={() => (onOpenSettings ? onOpenSettings() : setSettingsOpen(true))}
        removingIds={removingIds}
      />

      {/* Main content area */}
      <div className="app__content">
        <div className={`layout${rightPanelExpanded ? " layout--right-panel-expanded" : ""}`}>
          {/* Chat panel / History view / Scheduled tasks */}
          <div
            ref={chatPanelRef}
            className={surfaceClassName("canvas", `layout__chat${items.length === 0 ? " layout__chat--empty" : ""}`)}
            style={
              rightPanelExpanded
                ? { flex: "0 0 0", minWidth: 0, maxWidth: 0, paddingInline: 0, visibility: "hidden" }
                : openFiles.length > 0
                  ? chatWidth === null
                    ? { flex: "1 1 0", minWidth: 200, maxWidth: 2400 }
                    : { flex: `0 1 ${chatWidth}px`, minWidth: 200, maxWidth: 2400 }
                  : rightPanelOpen
                    ? { flex: "1 1 0", minWidth: 200 }
                    : { flex: "1 1 0" }
            }
          >
            {/* Right side-panel launcher; the main sidebar toggle stays in the titlebar. */}
            <div className="layout__chat-sidebar-actions">
              {!rightPanelOpen ? (
                <Tooltip text="Show side panel" side="bottom">
                  <button
                    type="button"
                    className="layout__chat-sidebar-button"
                    onClick={toggleRightPanelVisibility}
                    aria-label="Toggle side panel"
                    aria-pressed="false"
                  >
                    <RightSidebarToggleIcon />
                  </button>
                </Tooltip>
              ) : null}
            </div>

            {activeView === "history" ? (
              <ConversationHistoryView
                projects={projects}
                activeProjectId={activeProject}
                activeChatId={activeChat}
                onSelectChat={(projectId: string | null, chatId: string) => {
                  handlePickChatFromSidebar(projectId, chatId);
                }}
                getAllProjectChats={getAllProjectChats}
                onDeleteChat={(id: string) => handleCloseChat(id, applyChatRecord)}
              />
            ) : activeView === "scheduled" ? (
              <ScheduledTasksView
                activeProjectId={activeProject}
                projectName={projects.find((p) => p.id === activeProject)?.name}
                projects={projects}
              />
            ) : drillDownId ? (
              <SubAgentView items={drillItems} onBack={drillBack} cwd={cwd} />
            ) : (
              <>
                <ChatView
                  items={items}
                  streamingId={streamingNow}
                  busy={busy}
                  cwd={cwd}
                  onPickModel={handlePickModel}
                  onRevert={handleRevert}
                  onRegenerate={handleRegenerate}
                  onDrillDown={drillDown}
                  onOpenAgentDiff={handleOpenAgentDiff}
                />

                {todoTasks && <TodoView tasks={todoTasks} active={busy} changeSummary={todoChangeSummary} />}

                {items.length === 0 && (
                  <EmptyWorkspaceView
                    projectName={activeProjectName}
                    onSelectPrompt={(text: string) =>
                      setStarterDraft((previous) => ({ text, revision: previous.revision + 1 }))
                    }
                  />
                )}

                <div className="layout__composer-dock">
                  <Composer
                    disabled={busy}
                    workspace={cwd}
                    onSubmit={handleSubmit}
                    onStop={onStop}
                    currentModel={config.model ?? ""}
                    onPickModel={handlePickModel}
                    onOpenSettings={onOpenSettings}
                    initialText={rollbackText || starterDraft.text || undefined}
                    initialTextRevision={starterDraft.revision}
                    rollbackActive={rollbackIndex !== null}
                    rollbackText={rollbackText}
                    rollbackFileCount={rollbackChanged.length}
                    rollbackFilesChanged={rollbackChanged}
                    rollbackMessagesRemoved={rollbackRemoved}
                    onRollbackRestore={undoRollback}
                    providerId={config.providerId}
                    currentEffort={reasoningEffort}
                    onReasoningEffortChange={onReasoningEffortChange}
                    emptyState={items.length === 0}
                  />
                </div>
              </>
            )}
          </div>

          {openFiles.length > 0 && (
            <>
              {!rightPanelExpanded ? (
                <ResizeHandle targetRef={chatPanelRef} onCommit={setChatWidth} minWidth={200} maxWidth={2400} />
              ) : null}
              <div
                className={surfaceClassName(
                  "panel",
                  `layout__editor${rightPanelExpanded ? " layout__editor--behind-expanded-panel" : ""}`,
                )}
              >
                <EditorArea
                  openFiles={openFiles}
                  activeFile={activeFile}
                  previewFile={previewFile}
                  dirtyFiles={dirtyFiles}
                  onActivate={handleActivateFile}
                  onClose={handleCloseFile}
                  onDirtyChange={handleDirtyChange}
                  onPinFile={onPinFile}
                  cwd={cwd}
                  gotoLine={gotoLine}
                  gotoColumn={gotoColumn}
                  gotoMatchLength={gotoMatchLength}
                />
              </div>
            </>
          )}

          <div
            ref={rightPanelRef}
            className={`layout__right-panel-wrap${rightPanelOpen ? "" : " layout__right-panel-wrap--closed"}${rightPanelExpanded ? " layout__right-panel-wrap--expanded" : ""}`}
            data-animation={animationSettings.sidebarSlide}
            aria-hidden={!rightPanelOpen}
            style={
              !rightPanelOpen
                ? { flex: "0 0 0px", width: 0, minWidth: 0, maxWidth: 0 }
                : rightPanelExpanded
                  ? { flex: "1 1 100%", width: "100%", minWidth: 0, maxWidth: "none" }
                  : { flex: `0 1 ${rightPanelWidth}px`, width: rightPanelWidth, minWidth: 320, maxWidth: 1200 }
            }
          >
            {rightPanelOpen && !rightPanelExpanded ? (
              <ResizeHandle
                targetRef={rightPanelRef}
                onCommit={setRightPanelWidth}
                minWidth={320}
                maxWidth={Math.max(320, window.innerWidth - 352)}
                forceHandleSide="left"
              />
            ) : null}
            <div className={surfaceClassName("panel", "layout__right-panel-surface")}>
              <WorkspaceRightPanel
                tabs={rightPanelTabs}
                activeTab={activeRightPanelTab}
                expanded={rightPanelExpanded}
                newTabItems={rightPanelNewTabItems}
                onActivateTab={setActiveRightPanelTab}
                onCloseTab={closeRightPanelTab}
                onOpenTab={openRightPanelTab}
                onToggleExpanded={() => setRightPanelExpanded((expanded) => !expanded)}
                onToggleVisible={toggleRightPanelVisibility}
              >
                {fileTreeOpen ? (
                  <div className="workspace-right-panel__view" hidden={activeRightPanelTab !== "files"}>
                    <ExplorerView
                      cwd={cwd}
                      onOpenFile={handleOpenFile}
                      activeFile={activeFile}
                      revealPath={revealPath}
                    />
                  </div>
                ) : null}
                {searchInCodeOpen ? (
                  <div className="workspace-right-panel__view" hidden={activeRightPanelTab !== "search"}>
                    <SearchView cwd={cwd} onOpenFile={handleOpenFile} onClose={onCloseSearchInCode} />
                  </div>
                ) : null}
                {gitPanelOpen ? (
                  <div className="workspace-right-panel__view" hidden={activeRightPanelTab !== "git"}>
                    <ScmView cwd={cwd} onOpenFile={handleOpenFile} onClose={onCloseGitPanel} />
                  </div>
                ) : null}
                {terminalOpen ? (
                  <div className="workspace-right-panel__view" hidden={activeRightPanelTab !== "terminal"}>
                    <TerminalView active={rightPanelOpen && activeRightPanelTab === "terminal"} />
                  </div>
                ) : null}
                {browserOpen ? (
                  <div className="workspace-right-panel__view" hidden={activeRightPanelTab !== "browser"}>
                    <BrowserView active={rightPanelOpen && activeRightPanelTab === "browser"} />
                  </div>
                ) : null}
              </WorkspaceRightPanel>
            </div>
          </div>
        </div>
      </div>

      {editingProject ? (
        <EditWorkspaceDialog project={editingProject} onSave={completeEdit} onClose={cancelEdit} />
      ) : null}
    </div>
  );
}
