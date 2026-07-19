import React, { useState, useCallback, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ProjectRail } from "../ProjectRail/ProjectRail.js";
import { SessionList } from "../SessionList/SessionList.js";
import { AgentChat } from "../AgentChat/AgentChat.js";
import { SubAgentView } from "../SubAgentView/SubAgentView.js";
import { PromptInput } from "../PromptInput/PromptInput.js";
import { Todo } from "../Todo/Todo.js";
import { Terminals } from "../Terminals/Terminals.js";
import { EditorArea } from "../Editor/EditorArea.js";
import { SearchInCode } from "../SearchInCode/SearchInCode.js";
import { FileTree } from "../FileTree/FileTree.js";
import { EditProjectPopup } from "../EditProjectPopup/EditProjectPopup.js";
import { GitPanel } from "../GitPanel/GitPanel.js";
import type { Project, ChatSummary, VibeConfig, FileSnapshot } from "../../types.js";
import type { HistoryItem } from "../AgentChat/types.js";
import { recordToItems, localId } from "../../utils.js";
import { currentTodoTasks } from "../AgentChat/agentRunModel.js";

/** Drag-handle divider — directly manipulates the target element during drag,
 *  avoiding React re-renders. Only commits the final width to state on mouseup. */
function ResizeHandle({
  targetRef,
  onCommit,
  minWidth = 0,
  maxWidth = Infinity,
  direction = "horizontal",
  forceHandleSide,
}: {
  targetRef: React.RefObject<HTMLDivElement | null>;
  onCommit: (size: number) => void;
  minWidth?: number;
  maxWidth?: number;
  direction?: "horizontal" | "vertical";
  /** Override auto-detection of which side the handle is on.
   *  "right" → drag right/down grows target, drag left/up shrinks it (default behavior).
   *  "left"  → drag right/down shrinks target, drag left/up grows it. */
  forceHandleSide?: "left" | "right";
}): React.ReactElement {
  const dragging = useRef(false);
  const last = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const el = targetRef.current;
      if (!el) return;

      dragging.current = true;
      last.current = direction === "horizontal" ? e.clientX : e.clientY;
      document.body.classList.add("is-resizing");
      if (direction === "vertical") {
        document.body.classList.add("is-resizing-vertical");
      }

      // Determine whether the handle sits at the left/top or right/bottom edge of the target
      // Uses center-position comparison to work for both sibling handles (outside target)
      // and child handles (inside target)
      const handleRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const targetRect = el.getBoundingClientRect();
      const handleCx = (handleRect.left + handleRect.right) / 2;
      const targetCx = (targetRect.left + targetRect.right) / 2;
      const handleCy = (handleRect.top + handleRect.bottom) / 2;
      const targetCy = (targetRect.top + targetRect.bottom) / 2;
      const handleIsLeftOrTop =
        direction === "horizontal"
          ? forceHandleSide
            ? forceHandleSide === "left"
            : handleCx < targetCx
          : forceHandleSide
            ? forceHandleSide === "left"
            : handleCy < targetCy;

      function onMove(ev: MouseEvent) {
        if (!dragging.current) return;
        const cur = direction === "horizontal" ? ev.clientX : ev.clientY;
        const delta = cur - last.current;
        last.current = cur;

        const rect = el!.getBoundingClientRect();
        if (direction === "horizontal") {
          const newWidth = handleIsLeftOrTop ? rect.width - delta : rect.width + delta;
          const clamped = Math.max(minWidth, Math.min(maxWidth, newWidth));
          el!.style.flex = `0 1 ${clamped}px`;
        } else {
          const newHeight = handleIsLeftOrTop ? rect.height - delta : rect.height + delta;
          const clamped = Math.max(minWidth, Math.min(maxWidth, newHeight));
          el!.style.height = `${clamped}px`;
        }
      }
      function onUp() {
        dragging.current = false;
        document.body.classList.remove("is-resizing");
        document.body.classList.remove("is-resizing-vertical");
        if (el) {
          const finalSize =
            direction === "horizontal" ? el.getBoundingClientRect().width : el.getBoundingClientRect().height;
          onCommit(Math.round(finalSize));
        }
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      }
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [targetRef, onCommit, minWidth, maxWidth, direction, forceHandleSide],
  );

  return <div className={"resize-handle resize-handle--" + direction} onMouseDown={onMouseDown} aria-hidden="true" />;
}

interface AppMainProps {
  projects: Project[];
  activeProject: string | null;
  chatSideOpen: boolean;
  setChatSideOpen: (open: boolean) => void;
  chatSideSticky: boolean;
  setChatSideSticky: (sticky: boolean) => void;
  handlePickProject: (id: string, cb: any) => void;
  handleHoverProject: (id: string | null) => void;
  hoveredProject: Project | null;
  hoveredChats: ChatSummary[];
  handleAddProject: (cb: any) => void;
  handleCloseProject: () => void;
  handleRemoveProject: (id: string, cb: any) => void;
  onProjectChange: (newFolder: string | null, projectId: string | null) => void;
  setSettingsOpen: (open: boolean) => void;
  onOpenSettings?: (tab?: string) => void;
  sidebarWidth: number;
  handleSidebarResize: (width: number) => void;
  chats: ChatSummary[];
  activeChat: string | null;
  folder: string | null;
  config: VibeConfig;
  handlePickChat: (id: string, cb: any) => void;
  handleNewChat: (cb: any) => void;
  handleCloseChat: (id: string, cb: any) => void;
  items: any[];
  streamingNow: string | null;
  busy: boolean;
  handlePickModel: (model: string) => void;
  handleSubmit: (payload: any) => void;
  onStop: () => void;
  terminalOpen: boolean;
  setTerminalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  fileTreeOpen: boolean;
  gitPanelOpen?: boolean;
  onToggleGitPanel?: () => void;
  connectedModels: any[];
  openFiles: string[];
  activeFile: string | null;
  handleOpenFile: (path: string, line?: number, column?: number) => void;
  handleCloseFile: (path: string) => void;
  handleActivateFile: (path: string) => void;
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  revealPath?: string | null;
  setProjects?: (projects: Project[]) => void;
  searchInCodeOpen?: boolean;
  onCloseSearchInCode?: () => void;
  onCloseGitPanel?: () => void;
  gotoLine?: number;
  gotoColumn?: number;
  gotoMatchLength?: number;
}

export function AppMain({
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
  terminalOpen,
  setTerminalOpen,
  connectedModels,
  openFiles,
  activeFile,
  handleOpenFile,
  handleCloseFile,
  handleActivateFile,
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
}: AppMainProps) {
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
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

  // dirty files set — tracked here so EditorArea tabs can show the dot
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const handleDirtyChange = useCallback((path: string, dirty: boolean) => {
    setDirtyFiles((prev) => {
      const next = new Set(prev);
      if (dirty) next.add(path);
      else next.delete(path);
      return next;
    });
  }, []);

  // ── Rollback state ──
  const [rollbackIndex, setRollbackIndex] = useState<number | null>(null);
  const [rollbackText, setRollbackText] = useState("");
  const [rollbackRemovedItems, setRollbackRemovedItems] = useState<any[]>([]);
  const [rollbackChanged, setRollbackChanged] = useState<FileSnapshot[]>([]);
  const [rollbackRemoved, setRollbackRemoved] = useState(0);

  const clearRollback = useCallback(() => {
    setRollbackIndex(null);
    setRollbackText("");
    setRollbackRemovedItems([]);
    setRollbackChanged([]);
    setRollbackRemoved(0);
  }, []);

  // ── Sub-agent drill-down ──
  const [drillDownId, setDrillDownId] = useState<string | null>(null);
  const [drillItems, setDrillItems] = useState<HistoryItem[]>([]);

  const handleDrillDown = useCallback(
    async (id: string) => {
      const item = items.find((it: HistoryItem) => it.id === id);
      if (!item) return;
      setDrillDownId(id);

      if (item.subItems && item.subItems.length > 0) {
        setDrillItems(item.subItems);
        return;
      }

      try {
        const trace: any[] = await invoke("agent_get_sub_trace", { callId: id });
        const historyItems: HistoryItem[] = trace.map((ev: any) => {
          if (ev.kind === "chunk") {
            return { id: localId(), kind: "assistant" as const, text: ev.text ?? "" };
          }
          if (ev.kind === "tool-call") {
            return {
              id: ev.id ?? localId(),
              kind: "tool" as const,
              text: "",
              toolName: ev.name ?? "",
              toolArgs: ev.args ?? {},
            };
          }
          if (ev.kind === "tool-result") {
            return {
              id: ev.id ?? localId(),
              kind: "tool" as const,
              text: ev.text ?? "",
              ok: ev.ok ?? false,
            };
          }
          return { id: localId(), kind: "info" as const, text: "" };
        });
        setDrillItems(historyItems);
      } catch {
        setDrillItems([]);
      }
    },
    [items],
  );

  const handleUndoRollback = useCallback(async () => {
    if (rollbackIndex === null) return;
    try {
      await window.vibe.revertUndo();
    } catch {
      /* ignore */
    }
    setItems((prev: any[]) => [...prev, ...rollbackRemovedItems]);
    clearRollback();
  }, [rollbackIndex, rollbackRemovedItems, clearRollback]);

  const handleProjectEdit = useCallback((project: Project) => {
    setEditingProject(project);
  }, []);

  const handleProjectEditSave = useCallback(async () => {
    setEditingProject(null);
    const list = await window.vibe.projects.list();
    setProjects?.(list);
  }, [setProjects]);

  const handleProjectEditClose = useCallback(() => {
    setEditingProject(null);
  }, []);

  const handleProjectRemove = useCallback(
    (id: string) => {
      handleRemoveProject(id, onProjectChange);
    },
    [handleRemoveProject, onProjectChange],
  );

  const handleDrillBack = useCallback(() => {
    setDrillDownId(null);
    setDrillItems([]);
  }, []);

  return (
    <div className="app__body">
      {/* ── Left: project rail + chat sidebar ── */}
      <div
        className="sidebar-group"
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
          onPick={(id: string, _isMultiselect: boolean) =>
            handlePickChat(id, (record: any) => setItems(record ? recordToItems(record) : []))
          }
          onNew={() => handleNewChat(() => setItems([]))}
          onDelete={(id: string) => handleCloseChat(id, (record: any) => setItems(record ? recordToItems(record) : []))}
          onClose={() => {
            setChatSideSticky(false);
            setChatSideOpen(false);
          }}
          project={hoveredProject}
          onProjectEdit={handleProjectEdit}
          onProjectRemove={handleProjectRemove}
        />
      </div>

      {/* ── Main content area ── */}
      <div className="app__content">
        <div className="layout">
          {/* Chat panel */}
          <div
            ref={chatPanelRef}
            className="layout__chat"
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
              <SubAgentView items={drillItems} onBack={handleDrillBack} />
            ) : (
              <>
                <AgentChat
                  items={items}
                  streamingId={streamingNow}
                  busy={busy}
                  cwd={cwd}
                  onPickModel={handlePickModel}
                  onRevert={async (id: string) => {
                    if (busy) return;
                    const idx = items.findIndex((it) => it.id === id);
                    if (idx < 0) return;
                    const item = items[idx]!;
                    if (item.msgIndex === undefined) return;

                    try {
                      const result = await window.vibe.instantRevert(item.msgIndex);
                      const removed = items.slice(idx);
                      setRollbackRemovedItems(removed);
                      (window as any).__rollbackRemovedItems = removed;
                      setItems((prev: any[]) => prev.slice(0, idx));
                      setRollbackIndex(item.msgIndex);
                      setRollbackText(item.text);
                      setRollbackChanged(result.filesChanged);
                      const removedUserCount = removed.filter((it: any) => it.kind === "user").length;
                      setRollbackRemoved(removedUserCount);
                    } catch {
                      // revert failed silently
                    }
                  }}
                  onRegenerate={(id: string) => {
                    if (busy) return;
                    const idx = items.findIndex((it) => it.id === id);
                    if (idx < 0) return;
                    let userIdx = -1;
                    for (let i = idx - 1; i >= 0; i--) {
                      if (items[i]!.kind === "user") {
                        userIdx = i;
                        break;
                      }
                    }
                    if (userIdx < 0) return;
                    const userMsg = items[userIdx]!;
                    setItems((p) => p.slice(0, userIdx));
                    handleSubmit({
                      parts: [{ type: "text", text: userMsg.text }],
                      display: userMsg.text,
                      attachments: userMsg.attachments
                        ? userMsg.attachments.map((a: any) => ({
                            id: a.id,
                            kind: a.kind,
                            name: a.name,
                            path: a.path,
                            dataUrl: a.dataUrl,
                          }))
                        : [],
                    });
                  }}
                  onDrillDown={handleDrillDown}
                />

                {todoTasks && <Todo tasks={todoTasks} />}

                <PromptInput
                  disabled={busy}
                  workspace={cwd}
                  onSubmit={handleSubmit}
                  onStop={onStop}
                  models={connectedModels}
                  currentModel={config.model ?? ""}
                  onPickModel={handlePickModel}
                  onOpenSettings={onOpenSettings}
                  initialText={rollbackText || undefined}
                  rollbackActive={rollbackIndex !== null}
                  rollbackText={rollbackText}
                  rollbackFileCount={rollbackChanged.length}
                  rollbackFilesChanged={rollbackChanged}
                  rollbackMessagesRemoved={rollbackRemoved}
                  onRollbackRestore={handleUndoRollback}
                />
              </>
            )}

            <div
              ref={terminalPanelRef}
              className={`terminal-embedded ${!terminalOpen ? "terminal-embedded--closed" : ""}`}
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

          {/* Search in Code panel — always mounted to preserve state */}
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
            <div className="layout__search-code" style={{ flex: 1, minWidth: 200, maxWidth: 2400 }}>
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
            <div className="layout__search-code" style={{ flex: 1, minWidth: 200, maxWidth: 2400 }}>
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
              <div className="layout__editor">
                <EditorArea
                  openFiles={openFiles}
                  activeFile={activeFile}
                  dirtyFiles={dirtyFiles}
                  onActivate={handleActivateFile}
                  onClose={handleCloseFile}
                  onDirtyChange={handleDirtyChange}
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
            className={`sidebar ${!fileTreeOpen ? "sidebar--closed" : ""}`}
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

      {editingProject ? (
        <EditProjectPopup project={editingProject} onSave={handleProjectEditSave} onClose={handleProjectEditClose} />
      ) : null}
    </div>
  );
}
