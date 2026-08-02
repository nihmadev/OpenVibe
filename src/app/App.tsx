import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useAgentEvents } from "@/features/agent/application/useAgentEvents";
import { useSendMessage } from "@/features/agent/application/useSendMessage";
import { loadChatWorkspace, recordToItems } from "@/features/chats/application/chatWorkspace";
import { useChats } from "@/features/chats/application/useChats";
import { useProjectChatsPreview } from "@/features/chats/application/useProjectChatsPreview";
import type { ChatRecord } from "@/features/chats/model/chat";
import { WelcomeScreen } from "@/features/onboarding/ui/WelcomeScreen/WelcomeScreen";
import { useProjects } from "@/features/projects/application/useProjects";
import { Welcome } from "@/features/projects/ui/Welcome/Welcome";
import { changeWorkingDirectory, updateReasoningEffort } from "@/features/providers/application/providerConfig";
import { useModels } from "@/features/providers/application/useModels";
import type { VibeConfig } from "@/features/providers/model/provider";
import { SearchPopup } from "@/features/search/ui/SearchPopup/SearchPopup";
import { Settings } from "@/features/settings/ui/Settings";
import type { SettingsTab } from "@/features/settings/ui/types";
import { appState } from "@/shared/api/keyValueStore";
import { Loading } from "@/shared/ui/Loading/Loading";
import { Titlebar } from "@/shell/Titlebar/Titlebar";
import { useWorkspaceLayout } from "@/shell/useWorkspaceLayout";
import { WorkspaceShell } from "@/shell/WorkspaceShell";
import { AppProviders } from "./AppProviders";
import { FatalError } from "./FatalError/FatalError";
import { useAppCommands } from "./useAppCommands";
import { useAppInit } from "./useAppInit";

export function App(): React.ReactElement {
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

  useAppInit({
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
        <WelcomeScreen onComplete={() => setOnboardingCompleted(true)} onLanguageChange={setLang} />
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

  const searchPopup = searchOpen ? (
    <SearchPopup
      folder={folder}
      onClose={handleCloseSearch}
      onNewChat={() => {
        handleNewChatCommand();
        setSearchOpen(false);
      }}
      onSwitchChat={(dir) => {
        handleSwitchChat(dir);
        setSearchOpen(false);
      }}
      onToggleTerminal={() => {
        layout.setTerminalOpen((o) => !o);
        setSearchOpen(false);
      }}
      onOpenFile={layout.handleOpenFile}
      onRevealFolder={setRevealPath}
      onCommand={handleCommand}
    />
  ) : null;

  const settings = (
    <Settings
      open={settingsOpen}
      onClose={handleCloseSettings}
      onProviderChanged={(model, baseUrl) => setConfig((c) => (c ? { ...c, model, baseUrl } : c))}
      activeTab={settingsTab}
      onTabChange={setSettingsTab}
      onLanguageChange={setLang}
      shortcuts={shortcuts}
      onUpdateBinding={updateBinding}
      onResetBinding={resetBinding}
    />
  );

  if (!activeProject) {
    return (
      <AppProviders lang={lang}>
        <div className="app">
          {titlebar}
          {searchPopup}
          <Welcome
            projects={projects}
            activeProject={activeProject}
            handlePickProject={handlePickProject}
            handleAddProject={handleAddProject}
            handleCloseProject={handleCloseProject}
            handleRemoveProject={handleRemoveProject}
            onProjectChange={onProjectChange}
            setSettingsOpen={setSettingsOpen}
            removingIds={removingIds}
          />
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
        <WorkspaceShell
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
          chats={chats}
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
          gotoLine={layout.gotoLine}
          gotoColumn={layout.gotoColumn}
          gotoMatchLength={layout.gotoMatchLength}
        />
        {settings}
      </div>
    </AppProviders>
  );
}
