import { useCallback, useEffect, useRef, useState } from "react";
import { chatService, onChatsUpdated } from "@/workbench/services/chat/tauri/chatService";
import type { ChatRecord, ChatSummary } from "../common/chat";

export function useChats() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  // Track whether the current list order was set by us (stable) or needs a full reload
  const stableOrderRef = useRef(false);
  // Always-current refs so callbacks never capture stale values
  const activeChatRef = useRef<string | null>(null);
  const chatsRef = useRef<ChatSummary[]>([]);

  const setActiveChatSynced = useCallback((id: string | null) => {
    activeChatRef.current = id;
    setActiveChat(id);
  }, []);

  const setChatsSynced = useCallback((updater: ChatSummary[] | ((prev: ChatSummary[]) => ChatSummary[])) => {
    setChats((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      chatsRef.current = next;
      return next;
    });
  }, []);

  const loadChatList = useCallback(async () => {
    const all = await chatService.list();
    const list = all.filter((c) => c.messageCount > 0);
    setChatsSynced(list);
    stableOrderRef.current = true;
    return list;
  }, [setChatsSynced]);

  // Merge incoming list into existing order: update titles/counts, keep positions,
  // append genuinely new chats, remove deleted ones.
  const mergeChatList = useCallback(async () => {
    const incoming = (await chatService.list()).filter((c) => c.messageCount > 0);
    setChatsSynced((prev) => {
      if (!stableOrderRef.current || prev.length === 0) {
        stableOrderRef.current = true;
        return incoming;
      }
      const incomingMap = new Map(incoming.map((c) => [c.id, c]));
      // Update existing entries in place (preserves order), drop deleted ones
      const merged = prev.filter((c) => incomingMap.has(c.id)).map((c) => incomingMap.get(c.id)!);
      // Append any brand-new chats (not in prev) at the top
      const prevIds = new Set(prev.map((c) => c.id));
      const added = incoming.filter((c) => !prevIds.has(c.id));
      return [...added, ...merged];
    });
  }, [setChatsSynced]);

  useEffect(() => {
    const off = onChatsUpdated(() => {
      mergeChatList();
    });
    return off;
  }, [mergeChatList]);

  const handlePickChat = useCallback(
    async (id: string, onChatChange: (record: ChatRecord | null) => void) => {
      if (id === activeChatRef.current) return;

      // If the current active chat is not in the list (i.e. it's an empty new chat
      // that was never persisted with real messages), delete it from the DB so it
      // doesn't appear as a ghost "New Chat" entry in the session list.
      const prevId = activeChatRef.current;
      if (prevId) {
        const prevInList = chatsRef.current.find((c) => c.id === prevId);
        if (!prevInList) {
          chatService.delete(prevId).catch(() => {});
        }
      }

      const record = await chatService.open(id);
      setActiveChatSynced(id);
      onChatChange(record);
    },
    [setActiveChatSynced],
  );

  const isCreatingRef = useRef(false);

  const handleNewChat = useCallback(
    async (onChatChange: (record: ChatRecord | null) => void) => {
      // Prevent concurrent calls (e.g. double-click)
      if (isCreatingRef.current) return;
      isCreatingRef.current = true;

      // Enter the empty workspace immediately. Waiting for the persistence
      // round-trip left the previous conversation on screen until agent_reset,
      // chats_new and chats_open had all completed, which made the transition
      // happen on an arbitrary frame and visibly flash.
      onChatChange(null);

      try {
        const fresh = await chatService.new();
        if (!fresh) return;

        // chatService.new already resets the agent and makes this empty chat
        // active in the persistence layer. Opening it again only adds another
        // asynchronous state restoration between the click and the empty view.
        setActiveChatSynced(fresh.id);
      } finally {
        isCreatingRef.current = false;
      }
    },
    [setActiveChatSynced],
  );

  const handleCloseChat = useCallback(
    async (id: string, onChatChange: (record: ChatRecord | null) => void) => {
      // Update local state immediately for better UX
      setChatsSynced((prev) => prev.filter((c) => c.id !== id));

      await chatService.delete(id);
      const list = await chatService.list();
      if (list.length === 0) {
        const fresh = await chatService.new();
        if (fresh) {
          const record = await chatService.open(fresh.id);
          setActiveChatSynced(fresh.id);
          onChatChange(record);
        }
        return;
      }
      setChatsSynced(list);
      if (activeChatRef.current === id) {
        const next = list[0]!;
        const record = await chatService.open(next.id);
        setActiveChatSynced(next.id);
        onChatChange(record);
      }
    },
    [setActiveChatSynced, setChatsSynced],
  );

  return {
    chats,
    setChats: setChatsSynced,
    activeChat,
    setActiveChat: setActiveChatSynced,
    loadChatList,
    handleNewChat,
    handlePickChat,
    handleCloseChat,
  };
}
