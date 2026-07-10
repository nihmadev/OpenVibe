import React, { useState, useCallback, useEffect } from "react";
import { AppMain } from "../AppMain/AppMain.js";
import { Welcome } from "../Welcome/Welcome.js";
import { Settings } from "../Settings/Settings.js";
import { FatalError } from "../FatalError/FatalError.js";
import { Titlebar } from "../Titlebar/Titlebar.js";
import { SearchPopup } from "../SearchPopup/SearchPopup.js";
import { Loading } from "../Loading/Loading.js";
import { useProjects } from "../../hooks/useProjects.js";
import { useChats } from "../../hooks/useChats.js";
import { useModels } from "../../hooks/useModels.js";
import { useVibeEvents } from "../../hooks/useVibeEvents.js";
import { useAppInit } from "../../hooks/useAppInit.js";
import { useAppHandlers } from "../../hooks/useAppHandlers.js";
import { ThemeProvider } from "../../hooks/useTheme.js";
import { I18nProvider } from "../../hooks/useI18n.js";
import { AnimationProvider } from "../../hooks/useAnimations.js";
import { useShortcuts } from "../../hooks/useShortcuts.js";
import type { VibeConfig, Project, ChatSummary } from "../../types.js";
import { recordToItems } from "../../utils.js";
export function App(): React.ReactElement {
  const [state, setState] = useState<{ kind: "ok" } | { kind: "fatal"; error: string } | null>(null);
  const [config, setConfig] = useState<VibeConfig | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lang, setLang] = useState<string>("Russian");

  useEffect(() => {
    window.vibe.state.get("settings:language").then((v) => {
      if (v) setLang(v);
    });
  }, []);

  const [settingsTab, setSettingsTab] = useState<string>("general");
  const [searchOpen, setSearchOpen] = useState(false);
  const [revealPath, setRevealPath] = useState<string | null>(null);
  const handleOpenSearch = useCallback(() => {
    setRevealPath(null);
    setSearchOpen(true);
  }, []);
  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, []);
  const handleOpenSettings = useCallback((tab?: string) => {
    if (tab) setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);
  const [chatSideOpen, setChatSideOpen] = useState(false);
  const [chatSideSticky, setChatSideSticky] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [fileTreeOpen, setFileTreeOpen] = useState(true);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [hoveredProject, setHoveredProject] = useState<Project | null>(null);
  const [hoveredChats, setHoveredChats] = useState<ChatSummary[]>([]);

  const {
    projects,
    setProjects,
    activeProject,
    setActiveProject,
    folder,
    setFolder,
    handlePickProject,
    handleAddProject,
    handleCloseProject,
    handleRemoveProject,
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

  const handleCloseChat = useCallback(
    async (id: string, onChatChange: (record: any) => void) => {
      setHoveredChats((prev) => prev.filter((c) => c.id !== id));
      await baseHandleCloseChat(id, onChatChange);
    },
    [baseHandleCloseChat],
  );

  const { connectedModels, handlePickModel } = useModels(config, setConfig, settingsOpen);

  const { items, setItems, busy, pending, streamingNow, pendingAttachments } = useVibeEvents(useCallback(() => {}, []));

  const { handleSubmit } = useAppHandlers({
    setItems,
    pendingAttachments,
  });

  useAppInit({
    setConfig,
    setFolder,
    setState: setState as any,
    setProjects,
    setActiveProject,
    setChats,
    setActiveChat,
    setItems,
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
      if (newFolder) await window.vibe.setCwd(newFolder);
      const list = await window.vibe.chats.list();
      if (list.length === 0) {
        const fresh = await window.vibe.chats.new();
        if (fresh) {
          setChats([fresh]);
          setActiveChat(fresh.id);
          setItems([]);
        }
      } else {
        setChats(list);
        const top = list[0]!;
        const record = await window.vibe.chats.open(top.id);
        setActiveChat(top.id);
        setItems(record ? recordToItems(record) : []);
      }
    },
    [setFolder, setChats, setActiveChat, setItems],
  );

  const handleHoverProject = useCallback(
    async (id: string | null) => {
      if (!id) {
        setHoveredProject(null);
        setHoveredChats([]);
        return;
      }
      const proj = projects.find((p) => p.id === id) ?? null;
      setHoveredProject(proj);
      if (proj) {
        const list = await window.vibe.chats.listForProject(proj.id);
        setHoveredChats(list);
      }
    },
    [projects],
  );

  const handleDecide = useCallback(
    (decision: "yes" | "no" | "always") => {
      if (!pending) return;
      window.vibe.decide(pending.id, decision);
    },
    [pending],
  );

  const handleOpenFile = useCallback((path: string) => {
    setOpenFiles((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setActiveFile(path);
  }, []);

  const handleCloseFile = useCallback((path: string) => {
    setOpenFiles((prev) => {
      const next = prev.filter((p) => p !== path);
      setActiveFile((cur) => {
        if (cur !== path) return cur;
        if (next.length === 0) return null;
        const idx = prev.indexOf(path);
        return next[Math.min(idx, next.length - 1)] ?? null;
      });
      return next;
    });
  }, []);

  const handleActivateFile = useCallback((path: string) => {
    setActiveFile(path);
  }, []);

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

  // ── Shortcut wrappers ──
  const handleCycleFileTab = useCallback(
    (dir: "prev" | "next") => {
      if (openFiles.length === 0) return;
      const idx = openFiles.indexOf(activeFile ?? "");
      if (idx < 0) {
        handleActivateFile(openFiles[0]!);
        return;
      }
      const nextIdx = dir === "next" ? (idx + 1) % openFiles.length : (idx - 1 + openFiles.length) % openFiles.length;
      handleActivateFile(openFiles[nextIdx]!);
    },
    [openFiles, activeFile, handleActivateFile],
  );

  const handleCloseActiveFile = useCallback(() => {
    if (activeFile) handleCloseFile(activeFile);
  }, [activeFile, handleCloseFile]);

  const handleShortcutNewProject = useCallback(() => {
    handleAddProject(onProjectChange);
  }, [handleAddProject, onProjectChange]);

  const handleShortcutCloseProject = useCallback(() => {
    handleCloseProject();
    setChats([]);
    setActiveChat(null);
    setItems([]);
  }, [handleCloseProject, setChats, setActiveChat, setItems]);

  const handleShortcutClearChat = useCallback(() => {
    handleNewChat(() => setItems([]));
  }, [handleNewChat, setItems]);

  const handleShortcutNewChat = useCallback(() => {
    handleNewChat(() => setItems([]));
  }, [handleNewChat, setItems]);

  const handleToggleChatSide = useCallback(() => {
    setChatSideSticky((s) => !s);
    setChatSideOpen((o) => !o);
  }, []);

  const handlePickProjectByIndex = useCallback(
    (index: number) => {
      if (index < 0 || index >= projects.length) return;
      const project = projects[index]!;
      handlePickProject(project.id, onProjectChange);
    },
    [projects, handlePickProject, onProjectChange],
  );

  const { shortcuts, updateBinding, resetBinding } = useShortcuts({
    newChat: handleShortcutNewChat,
    switchChat: handleSwitchChat,
    toggleChatSide: handleToggleChatSide,
    toggleTerminal: () => setTerminalOpen((o) => !o),
    toggleFileTree: () => setFileTreeOpen((o) => !o),
    openSettings: handleOpenSettings,
    openSearch: handleOpenSearch,
    closeSettings: () => setSettingsOpen(false),
    clearChat: handleShortcutClearChat,
    focusInput: () => {
      const el = document.querySelector<HTMLElement>('[data-component="prompt-input"]');
      el?.focus();
    },
    closeActiveFile: handleCloseActiveFile,
    cycleFileTab: handleCycleFileTab,
    newProject: handleShortcutNewProject,
    closeProject: handleShortcutCloseProject,
    newTerminal: () => {
      window.dispatchEvent(new CustomEvent("vibe:new-terminal"));
    },
    switchTerminal: (dir) => {
      window.dispatchEvent(new CustomEvent("vibe:switch-terminal", { detail: { dir } }));
    },
    closeTerminal: () => {
      window.dispatchEvent(new CustomEvent("vibe:close-terminal"));
    },
    pickProject: handlePickProjectByIndex,
  });

  if (!state) return <Loading />;
  if (state.kind === "fatal") return <FatalError error={state.error} />;
  if (!config) return <Loading />;

  if (!activeProject) {
    return (
      <ThemeProvider>
        <I18nProvider lang={lang as any}>
          <AnimationProvider>
          <div className="app">
            <Titlebar
              chatSideOpen={chatSideOpen}
              onToggleChatSide={() => {
                setChatSideSticky(!chatSideSticky);
                setChatSideOpen(!chatSideOpen);
              }}
              onNewChat={() => handleNewChat(() => setItems([]))}
              onSwitchChat={handleSwitchChat}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              terminalOpen={terminalOpen}
              onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
              fileTreeOpen={fileTreeOpen}
              onToggleFileTree={() => setFileTreeOpen(!fileTreeOpen)}
              folder={folder}
              onSearchOpen={handleOpenSearch}
            />
            {searchOpen && (
              <SearchPopup
                folder={folder}
                onClose={handleCloseSearch}
                onNewChat={() => {
                  handleNewChat(() => setItems([]));
                  setSearchOpen(false);
                }}
                onSwitchChat={(dir) => {
                  handleSwitchChat(dir);
                  setSearchOpen(false);
                }}
                onToggleTerminal={() => {
                  setTerminalOpen((o) => !o);
                  setSearchOpen(false);
                }}
                onOpenFile={handleOpenFile}
                onRevealFolder={setRevealPath}
              />
            )}
            <Welcome
              projects={projects}
              activeProject={activeProject}
              handlePickProject={handlePickProject}
              handleAddProject={handleAddProject}
              handleCloseProject={handleCloseProject}
              handleRemoveProject={handleRemoveProject}
              onProjectChange={onProjectChange}
              setSettingsOpen={setSettingsOpen}
            />
            <Settings
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              onProviderChanged={(model, baseUrl) => setConfig((c) => (c ? { ...c, model, baseUrl } : c))}
              initialTab={settingsTab as any}
              onLanguageChange={setLang}
              shortcuts={shortcuts}
              onUpdateBinding={updateBinding}
              onResetBinding={resetBinding}
            />
          </div>
          </AnimationProvider>
        </I18nProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <I18nProvider lang={lang as any}>
        <AnimationProvider>
        <div className="app">
            <Titlebar
              chatSideOpen={chatSideOpen}
              onToggleChatSide={() => {
                setChatSideSticky(!chatSideSticky);
                setChatSideOpen(!chatSideOpen);
              }}
              onNewChat={() => handleNewChat(() => setItems([]))}
              onSwitchChat={handleSwitchChat}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              terminalOpen={terminalOpen}
              onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
              fileTreeOpen={fileTreeOpen}
              onToggleFileTree={() => setFileTreeOpen(!fileTreeOpen)}
              folder={folder}
              onSearchOpen={handleOpenSearch}
            />
            {searchOpen && (
              <SearchPopup
                folder={folder}
                onClose={handleCloseSearch}
                onNewChat={() => {
                  handleNewChat(() => setItems([]));
                  setSearchOpen(false);
                }}
                onSwitchChat={(dir) => {
                  handleSwitchChat(dir);
                  setSearchOpen(false);
                }}
                onToggleTerminal={() => {
                  setTerminalOpen((o) => !o);
                  setSearchOpen(false);
                }}
                onOpenFile={handleOpenFile}
                onRevealFolder={setRevealPath}
              />
            )}
            <AppMain
              revealPath={revealPath}
              projects={projects}
              activeProject={activeProject}
              chatSideOpen={chatSideOpen}
              setChatSideOpen={setChatSideOpen}
              chatSideSticky={chatSideSticky}
              setChatSideSticky={setChatSideSticky}
              handlePickProject={handlePickProject}
              handleHoverProject={handleHoverProject}
              hoveredProject={hoveredProject}
              hoveredChats={hoveredChats}
              handleAddProject={handleAddProject}
              handleCloseProject={handleCloseProject}
              handleRemoveProject={handleRemoveProject}
              onProjectChange={onProjectChange}
              setSettingsOpen={setSettingsOpen}
              onOpenSettings={handleOpenSettings}
              sidebarWidth={sidebarWidth}
              handleSidebarResize={setSidebarWidth}
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
              pending={pending}
              handlePickModel={handlePickModel}
              handleSubmit={handleSubmit}
              onStop={() => window.vibe.stop()}
              terminalOpen={terminalOpen}
              setTerminalOpen={setTerminalOpen}
              fileTreeOpen={fileTreeOpen}
              connectedModels={connectedModels}
              openFiles={openFiles}
              activeFile={activeFile}
              handleOpenFile={handleOpenFile}
              handleCloseFile={handleCloseFile}
              handleActivateFile={handleActivateFile}
              handleDecide={handleDecide}
              setItems={setItems}
              setProjects={setProjects}
            />
            <Settings
              open={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              onProviderChanged={(model, baseUrl) => setConfig((c) => (c ? { ...c, model, baseUrl } : c))}
              initialTab={settingsTab as any}
              onLanguageChange={setLang}
              shortcuts={shortcuts}
              onUpdateBinding={updateBinding}
              onResetBinding={resetBinding}
            />
          </div>
        </AnimationProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
