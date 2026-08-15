import { surfaceClassName } from "@zazaru/ui";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRegenerate } from "@/features/agent/application/useRegenerate";
import { useRollback } from "@/features/agent/application/useRollback";
import { useSubAgentDrilldown } from "@/features/agent/application/useSubAgentDrilldown";
import { currentTodoTasks } from "@/features/agent/model/agentRun";
import type { HistoryItem } from "@/features/agent/model/history";
import type { SendPayload } from "@/features/agent/model/sendPayload";
import { AgentChat } from "@/features/agent/ui/AgentChat/AgentChat";
import { PromptInput } from "@/features/agent/ui/PromptInput/PromptInput";
import { SubAgentView } from "@/features/agent/ui/SubAgentView/SubAgentView";
import { Todo } from "@/features/agent/ui/Todo/Todo";
import { hydrateRestoredMentions, recordToItems } from "@/features/chats/application/chatHistory";
import type { ChatRecord, ChatSummary } from "@/features/chats/model/chat";
import { SessionList } from "@/features/chats/ui/SessionList/SessionList";
import { EditorArea } from "@/features/editor/ui/Editor/EditorArea";
import { FileTree } from "@/features/files/ui/FileTree/FileTree";
import { GitPanel } from "@/features/git/ui/GitPanel/GitPanel";
import { useProjectEdit } from "@/features/projects/application/useProjectEdit";
import type { Project } from "@/features/projects/model/project";
import { EditProjectPopup } from "@/features/projects/ui/EditProjectPopup/EditProjectPopup";
import { ProjectRail } from "@/features/projects/ui/ProjectRail/ProjectRail";
import type { VibeConfig } from "@/features/providers/model/provider";
import { SearchInCode } from "@/features/search/ui/SearchInCode/SearchInCode";
import { Terminals } from "@/features/terminal/ui/Terminals/Terminals";
import { ResizeHandle } from "./panels/ResizeHandle";

type ChatChangeCallback = (record: ChatRecord | null) => void | Promise<void>;
type ProjectChangeCallback = (folder: string | null, projectId: string | null) => Promise<void>;

interface WorkspaceShellProps {
  projects: Project[];
  activeProject: string | null;
  chatSideOpen: boolean;
  setChatSideOpen: (open: boolean) => void;
  chatSideSticky: boolean;
  setChatSideSticky: (sticky: boolean) => void;
  handlePickProject: (id: string, cb: ProjectChangeCallback) => void;
  handleHoverProject: (id: string | null) => void;
  hoveredProject: Project | null;
  hoveredChats: ChatSummary[];
  handleAddProject: (cb: ProjectChangeCallback) => void;
  handleCloseProject: () => void;
  handleRemoveProject: (id: string, cb: ProjectChangeCallback) => void;
  onProjectChange: ProjectChangeCallback;
  setSettingsOpen: (open: boolean) => void;
  onOpenSettings?: (tab?: string) => void;
  sidebarWidth: number;
  handleSidebarResize: (width: number) => void;
  chats: ChatSummary[];
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
  gotoLine?: number;
  gotoColumn?: number;
  gotoMatchLength?: number;
  removingIds?: Set<string>;
}

export function WorkspaceShell({
  projects,
  activeProject,
  chatSideOpen,
  setChatSideOpen,
  chatSideSticky,
  setChatSideSticky,
  handlePickProject,
  handleHoverProject,
  hoveredProject,
  hoveredChats,
  handleAddProject,
  handleCloseProject,
  handleRemoveProject,
  onProjectChange,
  setSettingsOpen,
  onOpenSettings,
  sidebarWidth,
  handleSidebarResize,
  chats,
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
  gotoLine,
  gotoColumn,
  gotoMatchLength,
  removingIds,
}: WorkspaceShellProps) {
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const cwd = folder ?? config.cwd;
  const todoTasks = useMemo(() => currentTodoTasks(items), [items]);

  // Keep chat and editor balanced until the user explicitly resizes them.
  // A fixed 320px initial chat width made the first opened editor consume most
  // of a wide window. Once resized, the chosen pixel width is kept as before.
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const [searchWidth, setSearchWidth] = useState(400);
  const [gitWidth, setGitWidth] = useState(300);
  const [ftreeWidth, setFtreeWidth] = useState(280);
  const [terminalHeight, setTerminalHeight] = useState(300);

  // Refs for direct DOM manipulation during resize (avoids React re-renders on every mousemove)
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const gitPanelRef = useRef<HTMLDivElement>(null);
  const ftreePanelRef = useRef<HTMLDivElement>(null);
  const terminalPanelRef = useRef<HTMLDivElement>(null);

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

  const { editingProject, startEdit, cancelEdit, completeEdit } = useProjectEdit(setProjects);

  const handleProjectRemove = useCallback(
    (id: string) => {
      handleRemoveProject(id, onProjectChange);
    },
    [handleRemoveProject, onProjectChange],
  );

  return (
    <div className="app__body">
      {/* Left: project rail + chat sidebar */}
      <div
        className={surfaceClassName("transparent", "sidebar-group")}
        onMouseLeave={() => {
          if (!chatSideSticky && !sidebarResizing) {
            setChatSideOpen(false);
          }
          if (!sidebarResizing) {
            handleHoverProject(null);
          }
        }}
      >
        <ProjectRail
          projects={projects}
          activeId={activeProject}
          onHover={(id) => {
            if (id !== null) setChatSideOpen(true);
            handleHoverProject(id);
          }}
          onPick={(id) => {
            handleHoverProject(null);
            setChatSideSticky(true);
            setChatSideOpen(true);
            handlePickProject(id, onProjectChange);
          }}
          onAdd={() => handleAddProject(onProjectChange)}
          onClose={handleCloseProject}
          onRemove={(id) => handleRemoveProject(id, onProjectChange)}
          onSettings={() => setSettingsOpen(true)}
          removingIds={removingIds}
        />
        <SessionList
          open={chatSideOpen}
          width={sidebarWidth}
          onResize={handleSidebarResize}
          onResizingChange={setSidebarResizing}
          chats={
            hoveredProject ? hoveredChats.filter((c) => c.messageCount > 0) : chats.filter((c) => c.messageCount > 0)
          }
          activeId={hoveredProject ? null : activeChat}
          workspace={hoveredProject ? hoveredProject.path : cwd}
          workspaceLabel={hoveredProject ? hoveredProject.name : (cwd.split(/[\\/]/).filter(Boolean).pop() ?? "vibe")}
          onPick={(id: string, _isMultiselect: boolean) => handlePickChat(id, applyChatRecord)}
          onNew={() => handleNewChat(() => setItems([]))}
          onDelete={(id: string) => handleCloseChat(id, applyChatRecord)}
          onClose={() => {
            setChatSideSticky(false);
            setChatSideOpen(false);
          }}
          project={hoveredProject}
          onProjectEdit={startEdit}
          onProjectRemove={handleProjectRemove}
        />
      </div>

      {/* Main content area */}
      <div className="app__content">
        <div className="layout">
          {/* Chat panel */}
          <div
            ref={chatPanelRef}
            className={surfaceClassName("canvas", `layout__chat${items.length === 0 ? " layout__chat--empty" : ""}`)}
            style={
              openFiles.length > 0
                ? chatWidth === null
                  ? { flex: "1 1 0", minWidth: 200, maxWidth: 2400 }
                  : { flex: `0 1 ${chatWidth}px`, minWidth: 200, maxWidth: 2400 }
                : searchInCodeOpen || gitPanelOpen
                  ? { flex: "1 1 0", minWidth: 200 }
                  : { flex: "1 1 0" }
            }
          >
            {drillDownId ? (
              <SubAgentView items={drillItems} onBack={drillBack} cwd={cwd} />
            ) : (
              <>
                <AgentChat
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

                {todoTasks && <Todo tasks={todoTasks} />}

                <PromptInput
                  disabled={busy}
                  workspace={cwd}
                  onSubmit={handleSubmit}
                  onStop={onStop}
                  currentModel={config.model ?? ""}
                  onPickModel={handlePickModel}
                  onOpenSettings={onOpenSettings}
                  initialText={rollbackText || undefined}
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
              </>
            )}

            <div
              ref={terminalPanelRef}
              className={
                terminalOpen
                  ? surfaceClassName("panel", "terminal-embedded")
                  : "terminal-embedded terminal-embedded--closed"
              }
              style={
                {
                  height: terminalOpen ? `${terminalHeight}px` : undefined,
                  "--terminal-height": `${terminalHeight}px`,
                } as React.CSSProperties
              }
            >
              {terminalOpen && (
                <ResizeHandle
                  targetRef={terminalPanelRef}
                  onCommit={setTerminalHeight}
                  minWidth={100}
                  maxWidth={800}
                  direction="vertical"
                />
              )}
              <Terminals active={terminalOpen} />
            </div>
          </div>

          {/* Search in Code panel - always mounted to preserve state */}
          <div
            ref={searchWrapRef}
            className={`layout__search-code-wrap ${!searchInCodeOpen ? "layout__search-code-wrap--closed" : ""}`}
            style={
              searchInCodeOpen
                ? { flex: `0 1 ${searchWidth}px`, minWidth: 200, maxWidth: 2400 }
                : { flex: "0 1 0", minWidth: 0, maxWidth: 0 }
            }
          >
            {openFiles.length > 0 ? (
              <ResizeHandle targetRef={chatPanelRef} onCommit={setChatWidth} minWidth={200} maxWidth={2400} />
            ) : (
              <ResizeHandle
                targetRef={searchWrapRef}
                onCommit={setSearchWidth}
                minWidth={200}
                maxWidth={2400}
                forceHandleSide="left"
              />
            )}
            <div
              className={surfaceClassName("panel", "layout__search-code")}
              style={{ flex: 1, minWidth: 200, maxWidth: 2400 }}
            >
              <SearchInCode cwd={cwd} onOpenFile={handleOpenFile} onClose={onCloseSearchInCode} />
            </div>
            {fileTreeOpen && !gitPanelOpen && openFiles.length === 0 && (
              <ResizeHandle targetRef={ftreePanelRef} onCommit={setFtreeWidth} minWidth={160} maxWidth={2400} />
            )}
          </div>

          {/* Git Panel */}
          <div
            ref={gitPanelRef}
            className={`layout__search-code-wrap ${!gitPanelOpen ? "layout__search-code-wrap--closed" : ""}`}
            style={
              gitPanelOpen
                ? { flex: `0 1 ${gitWidth}px`, minWidth: 200, maxWidth: 2400 }
                : { flex: "0 1 0", minWidth: 0, maxWidth: 0 }
            }
          >
            {openFiles.length > 0 ? (
              <ResizeHandle
                targetRef={searchInCodeOpen ? searchWrapRef : chatPanelRef}
                onCommit={searchInCodeOpen ? setSearchWidth : setChatWidth}
                minWidth={200}
                maxWidth={2400}
              />
            ) : (
              <ResizeHandle
                targetRef={gitPanelRef}
                onCommit={setGitWidth}
                minWidth={200}
                maxWidth={2400}
                forceHandleSide="left"
              />
            )}
            <div
              className={surfaceClassName("panel", "layout__search-code")}
              style={{ flex: 1, minWidth: 200, maxWidth: 2400 }}
            >
              <GitPanel cwd={cwd} onOpenFile={handleOpenFile} onClose={onCloseGitPanel} />
            </div>
            {fileTreeOpen && openFiles.length === 0 && (
              <ResizeHandle targetRef={ftreePanelRef} onCommit={setFtreeWidth} minWidth={160} maxWidth={2400} />
            )}
          </div>

          {openFiles.length > 0 && (
            <>
              <ResizeHandle
                targetRef={gitPanelOpen ? gitPanelRef : searchInCodeOpen ? searchWrapRef : chatPanelRef}
                onCommit={gitPanelOpen ? setGitWidth : searchInCodeOpen ? setSearchWidth : setChatWidth}
                minWidth={200}
                maxWidth={2400}
              />
              <div className={surfaceClassName("panel", "layout__editor")}>
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
              {fileTreeOpen && (
                <ResizeHandle targetRef={ftreePanelRef} onCommit={setFtreeWidth} minWidth={160} maxWidth={2400} />
              )}
            </>
          )}

          {!searchInCodeOpen && openFiles.length === 0 && fileTreeOpen && !gitPanelOpen && (
            <ResizeHandle targetRef={ftreePanelRef} onCommit={setFtreeWidth} minWidth={160} maxWidth={2400} />
          )}

          {/* File tree sidebar */}
          <aside
            ref={ftreePanelRef}
            className={fileTreeOpen ? surfaceClassName("panel", "sidebar") : "sidebar sidebar--closed"}
            style={
              fileTreeOpen
                ? { flex: `0 1 ${ftreeWidth}px`, minWidth: 160, maxWidth: 2400 }
                : { flex: "0 1 0", minWidth: 0, maxWidth: 0 }
            }
          >
            <FileTree cwd={cwd} onOpenFile={handleOpenFile} activeFile={activeFile} revealPath={revealPath} />
          </aside>
        </div>
      </div>

      {editingProject ? <EditProjectPopup project={editingProject} onSave={completeEdit} onClose={cancelEdit} /> : null}
    </div>
  );
}
