import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { KeyCombo, ShortcutDef } from "@/platform/keybinding/common/keybinding";
import { appState } from "@/platform/storage/common/keyValueStore";
import { Loading } from "@/workbench/browser/loading/loadingView";
import { Titlebar } from "@/workbench/browser/parts/titlebar/titlebar";
import { useWorkspaceLayout } from "@/workbench/browser/useWorkbenchLayout";
import { Workbench, type WorkbenchContributions } from "@/workbench/browser/workbench";
import type { SettingsTab } from "@/workbench/common/preferences";
import { useAgentEvents } from "@/workbench/services/agent/browser/useAgentEvents";
import { useSendMessage } from "@/workbench/services/agent/browser/useSendMessage";
import {
  changeWorkingDirectory,
  updateReasoningEffort,
} from "@/workbench/services/aiProviders/browser/aiProviderConfiguration";
import { useModels } from "@/workbench/services/aiProviders/browser/useModels";
import type { VibeConfig } from "@/workbench/services/aiProviders/common/aiProvider";
import { loadChatWorkspace, recordToItems } from "@/workbench/services/chat/browser/chatWorkspace";
import { useChats } from "@/workbench/services/chat/browser/useChats";
import { useProjectChatsPreview } from "@/workbench/services/chat/browser/useProjectChatsPreview";
import type { ChatRecord } from "@/workbench/services/chat/common/chat";
import { useProjects } from "@/workbench/services/workspace/browser/useWorkspaces";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import { FatalError } from "./fatalError/fatalErrorView";
import { useAppCommands } from "./useWorkbenchCommands";
import { useWorkbenchInitialization, type WorkbenchInitializationResult } from "./useWorkbenchInitialization";
import { AppProviders } from "./workbenchProviders";

type ProjectChangeCallback = (folder: string | null, projectId: string | null) => Promise<void>;

interface OnboardingSlotProps {
  onComplete: () => void;
  onLanguageChange: (language: string) => void;
}

interface WorkspaceWelcomeSlotProps {
  projects: Project[];
  activeProject: string | null;
  handlePickProject: (id: string, callback: ProjectChangeCallback) => void | Promise<void>;
  handleAddProject: (callback: ProjectChangeCallback) => void | Promise<void>;
  handleCloseProject: () => void;
  handleRemoveProject: (id: string, callback: ProjectChangeCallback) => void | Promise<void>;
  onProjectChange: ProjectChangeCallback;
  setSettingsOpen: (open: boolean) => void;
  removingIds?: Set<string>;
}

interface QuickAccessSlotProps {
  folder: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSwitchChat: (direction: "prev" | "next") => void;
  onToggleTerminal: () => void;
  onOpenFile?: (path: string) => void;
  onRevealFolder?: (path: string) => void;
  onCommand?: (id: string) => void;
}

interface PreferencesSlotProps {
  open: boolean;
  onClose: () => void;
  onProviderChanged?: (model: string, baseUrl: string) => void;
  activeTab?: SettingsTab;
  onTabChange?: (tab: SettingsTab) => void;
  onLanguageChange?: (language: string) => void;
  shortcuts?: ShortcutDef[];
  onUpdateBinding?: (id: string, combo: KeyCombo) => Promise<void>;
  onResetBinding?: (id: string) => Promise<void>;
}

export interface DesktopContributions {
  workbench: WorkbenchContributions;
  subscribeBrowserSessionVisibility?: (listener: (open: boolean) => void) => () => void;
  renderOnboarding: (props: OnboardingSlotProps) => React.ReactNode;
  renderWorkspaceWelcome: (props: WorkspaceWelcomeSlotProps) => React.ReactNode;
  renderQuickAccess: (props: QuickAccessSlotProps) => React.ReactNode;
  renderPreferences: (props: PreferencesSlotProps) => React.ReactNode;
}

interface DesktopApplicationProps {
  contributions: DesktopContributions;
  initializeWorkbench: () => Promise<WorkbenchInitializationResult>;
}

export function DesktopApplication({
  contributions,
  initializeWorkbench,
}: DesktopApplicationProps): React.ReactElement {
  const [state, setState] = useState<{ kind: "ok" } | { kind: "fatal"; error: string } | null>(null);
  const [config, setConfig] = useState<VibeConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Use clear, internationally understandable English for the first-run flow.
  // The user's saved language is loaded immediately below and still takes precedence.
  const [lang, setLang] = useState<string>("English");
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    appState.get("settings:language").then((v) => {
      if (v) setLang(v);
    });
    appState.get("onboarding:completed").then((v) => {
      setOnboardingCompleted(v === "true");
    });
  }, []);

  useEffect(() => {
    const handler = () => setOnboardingCompleted(false);
    window.addEventListener("vibe:open-welcome-screen", handler);
    return () => window.removeEventListener("vibe:open-welcome-screen", handler);
  }, []);

  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [searchOpen, setSearchOpen] = useState(false);
  const [revealPath, setRevealPath] = useState<string | null>(null);

  const layout = useWorkspaceLayout();

  useEffect(() => {
    return contributions.subscribeBrowserSessionVisibility?.(layout.setBrowserOpen);
  }, [contributions, layout.setBrowserOpen]);

  const handleOpenSearch = useCallback(() => {
    setRevealPath(null);
    setSearchOpen(true);
  }, []);
  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);
  const handleOpenSettings = useCallback((tab?: string) => {
    if (tab) setSettingsTab(tab as SettingsTab);
    setSettingsOpen(true);
  }, []);
  const handleCloseSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  const {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    folder,
    setFolder,
    removingIds,
    handlePickProject,
    handleAddProject,
    handleCloseProject,
    handleRemoveProject,
    validateProjectPaths,
    setOnProjectChange,
  } = useProjects();

  const {
    chats,
    setChats,
    activeChat,
    setActiveChat,
    handlePickChat,
    handleNewChat,
    handleCloseChat: baseHandleCloseChat,
  } = useChats();

  const { hoveredProject, hoveredChats, hoverProject, dropChatFromPreview } = useProjectChatsPreview(projects);

  const handleCloseChat = useCallback(
    async (id: string, onChatChange: (record: ChatRecord | null) => void) => {
      dropChatFromPreview(id);
      await baseHandleCloseChat(id, onChatChange);
    },
    [baseHandleCloseChat, dropChatFromPreview],
  );

  const { handlePickModel } = useModels(config, setConfig, settingsOpen);
  const [reasoningEffort, setReasoningEffort] = useState<string | undefined>(config?.reasoningEffort ?? undefined);
  useEffect(() => {
    setReasoningEffort(config?.reasoningEffort ?? undefined);
  }, [config?.reasoningEffort]);
  const handleReasoningEffortChange = useCallback((effort: string | null) => {
    const val = effort ?? undefined;
    setReasoningEffort(val);
    updateReasoningEffort(effort);
    setConfig((c) => (c ? { ...c, reasoningEffort: val } : c));
  }, []);

  const { items, setItems, busy, streamingNow, pendingAttachments, pendingMentions } = useAgentEvents(
    useCallback(() => {}, []),
  );

  const { handleSubmit, handleStop } = useSendMessage({
    setItems,
    pendingAttachments,
    pendingMentions,
  });

  useWorkbenchInitialization({
    initializeWorkbench,
    setConfig,
    setFolder,
    setState,
    setProjects,
    setActiveProject,
    setChats,
    setActiveChat,
    setItems,
    validateProjectPaths,
  });

  const onProjectChange = useCallback(
    async (newFolder: string | null, projectId: string | null) => {
      setFolder(newFolder);
      if (!projectId) {
        setChats([]);
        setActiveChat(null);
        setItems([]);
        return;
      }
      if (newFolder) await changeWorkingDirectory(newFolder);
      const workspace = await loadChatWorkspace();
      setChats(workspace.chats);
      setActiveChat(workspace.activeChatId);
      setItems(workspace.record ? recordToItems(workspace.record) : []);
    },
    [setFolder, setChats, setActiveChat, setItems],
  );

  // Keep the periodic folder-existence check in useProjects aware of the
  // current onProjectChange so it can switch the active project when a
  // folder is deleted while the app is open.
  useEffect(() => {
    setOnProjectChange(onProjectChange);
  }, [onProjectChange, setOnProjectChange]);

  const handleSwitchChat = useCallback(
    (direction: "prev" | "next") => {
      if (chats.length <= 1) return;
      const idx = chats.findIndex((c) => c.id === activeChat);
      if (idx < 0) return;
      const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
      if (nextIdx < 0 || nextIdx >= chats.length) return;
      const nextChat = chats[nextIdx]!;
      handlePickChat(nextChat.id, (record) => {
        setItems(record ? recordToItems(record) : []);
      });
    },
    [chats, activeChat, handlePickChat, setItems],
  );

  const chatIdx = chats.findIndex((c) => c.id === activeChat);
  const canGoBack = chatIdx > 0;
  const canGoForward = chatIdx >= 0 && chatIdx < chats.length - 1;

  const handleNewChatCommand = useCallback(() => {
    handleNewChat(() => setItems([]));
  }, [handleNewChat, setItems]);

  const handleNewProjectCommand = useCallback(() => {
    handleAddProject(onProjectChange);
  }, [handleAddProject, onProjectChange]);

  const handleCloseProjectCommand = useCallback(() => {
    handleCloseProject();
    setChats([]);
    setActiveChat(null);
    setItems([]);
  }, [handleCloseProject, setChats, setActiveChat, setItems]);

  const handlePickProjectByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= projects.length) return;
      const project = projects[index]!;
      handlePickProject(project.id, onProjectChange);
    },
    [projects, handlePickProject, onProjectChange],
  );

  const { handleCommand, shortcuts, updateBinding, resetBinding } = useAppCommands(layout, {
    newChat: handleNewChatCommand,
    clearChat: handleNewChatCommand,
    switchChat: handleSwitchChat,
    newProject: handleNewProjectCommand,
    closeProject: handleCloseProjectCommand,
    pickProjectByIndex: handlePickProjectByIndex,
    openSettings: handleOpenSettings,
    closeSettings: handleCloseSettings,
    openSearch: handleOpenSearch,
  });

  if (!state) return <Loading />;
  if (state.kind === "fatal") return <FatalError error={state.error} />;
  if (!config) return <Loading />;
  if (onboardingCompleted === null) return <Loading />;

  if (!onboardingCompleted) {
    return (
      <AppProviders lang={lang}>
        {contributions.renderOnboarding({
          onComplete: () => setOnboardingCompleted(true),
          onLanguageChange: setLang,
        })}
      </AppProviders>
    );
  }

  const titlebar = (
    <Titlebar
      chatSideOpen={layout.chatSideOpen}
      onToggleChatSide={layout.handleToggleChatSide}
      onNewChat={handleNewChatCommand}
      onSwitchChat={handleSwitchChat}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      terminalOpen={layout.terminalOpen}
      onToggleTerminal={() => layout.setTerminalOpen((o) => !o)}
      searchInCodeOpen={layout.searchInCodeOpen}
      onToggleSearchInCode={layout.handleToggleSearchInCode}
      fileTreeOpen={layout.fileTreeOpen}
      onToggleFileTree={() => layout.setFileTreeOpen((o) => !o)}
      gitPanelOpen={layout.gitPanelOpen}
      onToggleGitPanel={layout.handleToggleGitPanel}
      folder={folder}
      onSearchOpen={handleOpenSearch}
      onOpenSettings={handleOpenSettings}
    />
  );

  const searchPopup = searchOpen
    ? contributions.renderQuickAccess({
        folder,
        onClose: handleCloseSearch,
        onNewChat: () => {
          handleNewChatCommand();
          setSearchOpen(false);
        },
        onSwitchChat: (direction) => {
          handleSwitchChat(direction);
          setSearchOpen(false);
        },
        onToggleTerminal: () => {
          layout.setTerminalOpen((open) => !open);
          setSearchOpen(false);
        },
        onOpenFile: layout.handleOpenFile,
        onRevealFolder: setRevealPath,
        onCommand: handleCommand,
      })
    : null;

  const settings = contributions.renderPreferences({
    open: settingsOpen,
    onClose: handleCloseSettings,
    onProviderChanged: (model, baseUrl) => setConfig((current) => (current ? { ...current, model, baseUrl } : current)),
    activeTab: settingsTab,
    onTabChange: setSettingsTab,
    onLanguageChange: setLang,
    shortcuts,
    onUpdateBinding: updateBinding,
    onResetBinding: resetBinding,
  });

  if (!activeProject) {
    return (
      <AppProviders lang={lang}>
        <div className="app">
          {titlebar}
          {searchPopup}
          {contributions.renderWorkspaceWelcome({
            projects,
            activeProject,
            handlePickProject,
            handleAddProject,
            handleCloseProject,
            handleRemoveProject,
            onProjectChange,
            setSettingsOpen,
            removingIds,
          })}
          {settings}
        </div>
      </AppProviders>
    );
  }

  return (
    <AppProviders lang={lang}>
      <div className="app">
        {titlebar}
        {searchPopup}
        <Workbench
          contributions={contributions.workbench}
          revealPath={revealPath}
          projects={projects}
          activeProject={activeProject}
          removingIds={removingIds}
          chatSideOpen={layout.chatSideOpen}
          setChatSideOpen={layout.setChatSideOpen}
          chatSideSticky={layout.chatSideSticky}
          setChatSideSticky={layout.setChatSideSticky}
          handlePickProject={handlePickProject}
          handleHoverProject={hoverProject}
          hoveredProject={hoveredProject}
          hoveredChats={hoveredChats}
          handleAddProject={handleAddProject}
          handleCloseProject={handleCloseProject}
          handleRemoveProject={handleRemoveProject}
          onProjectChange={onProjectChange}
          setSettingsOpen={setSettingsOpen}
          onOpenSettings={handleOpenSettings}
          sidebarWidth={layout.sidebarWidth}
          handleSidebarResize={layout.setSidebarWidth}
          activeChat={activeChat}
          folder={folder}
          config={config}
          handlePickChat={handlePickChat}
          handleNewChat={handleNewChat}
          handleCloseChat={handleCloseChat}
          items={items}
          streamingNow={streamingNow}
          busy={busy}
          handlePickModel={handlePickModel}
          handleSubmit={handleSubmit}
          onStop={handleStop}
          reasoningEffort={reasoningEffort}
          onReasoningEffortChange={handleReasoningEffortChange}
          terminalOpen={layout.terminalOpen}
          browserOpen={layout.browserOpen}
          fileTreeOpen={layout.fileTreeOpen}
          gitPanelOpen={layout.gitPanelOpen}
          openFiles={layout.openFiles}
          activeFile={layout.activeFile}
          previewFile={layout.previewFile}
          handleOpenFile={layout.handleOpenFile}
          handleCloseFile={layout.handleCloseFile}
          handleActivateFile={layout.handleActivateFile}
          onPinFile={layout.handlePinFile}
          setItems={setItems}
          setProjects={setProjects}
          searchInCodeOpen={layout.searchInCodeOpen}
          onCloseSearchInCode={() => layout.setSearchInCodeOpen(false)}
          onCloseGitPanel={() => layout.setGitPanelOpen(false)}
          onToggleFileTree={() => layout.setFileTreeOpen(!layout.fileTreeOpen)}
          onToggleSearchInCode={() => layout.setSearchInCodeOpen(!layout.searchInCodeOpen)}
          onToggleGitPanel={() => layout.setGitPanelOpen(!layout.gitPanelOpen)}
          onToggleTerminal={() => layout.setTerminalOpen(!layout.terminalOpen)}
          onToggleBrowser={() => layout.setBrowserOpen(!layout.browserOpen)}
          gotoLine={layout.gotoLine}
          gotoColumn={layout.gotoColumn}
          gotoMatchLength={layout.gotoMatchLength}
        />
        {settings}
      </div>
    </AppProviders>
  );
}
