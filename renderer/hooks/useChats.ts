import { useState, useCallback, useEffect, useRef } from "react";
import type { ChatSummary, ChatRecord } from "../types.js";

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
    const list = await window.vibe.chats.list();
    setChatsSynced(list);
    stableOrderRef.current = true;
    return list;
  }, [setChatsSynced]);

  // Merge incoming list into existing order: update titles/counts, keep positions,
  // append genuinely new chats, remove deleted ones.
  const mergeChatList = useCallback(async () => {
    const incoming = await window.vibe.chats.list();
    setChatsSynced((prev) => {
      if (!stableOrderRef.current || prev.length === 0) {
        stableOrderRef.current = true;
        return incoming;
      }
      const incomingMap = new Map(incoming.map((c) => [c.id, c]));
      // Update existing entries in place (preserves order), drop deleted ones
      const merged = prev
        .filter((c) => incomingMap.has(c.id))
        .map((c) => incomingMap.get(c.id)!);
      // Append any brand-new chats (not in prev) at the top
      const prevIds = new Set(prev.map((c) => c.id));
      const added = incoming.filter((c) => !prevIds.has(c.id));
      return [...added, ...merged];
    });
  }, [setChatsSynced]);

  useEffect(() => {
    const off = window.vibe.onChatsUpdated(() => {
      mergeChatList();
    });
    return off;
  }, [mergeChatList]);

  const handlePickChat = useCallback(
    async (id: string, onChatChange: (record: ChatRecord | null) => void) => {
      if (id === activeChatRef.current) return;
      const record = await window.vibe.chats.open(id);
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
      try {
        const fresh = await window.vibe.chats.new();
        if (!fresh) return;

        // Same chat was cleared in-place — just update list and clear UI
        if (fresh.id === activeChatRef.current) {
          setChatsSynced((p) => {
            const without = p.filter((c) => c.id !== fresh.id);
            return [fresh, ...without];
          });
          onChatChange(null);
          return;
        }

        // Open and update state in one batch to avoid intermediate renders (flicker).
        const record = await window.vibe.chats.open(fresh.id);
        setChatsSynced((p) => {
          const without = p.filter((c) => c.id !== fresh.id);
          return [fresh, ...without];
        });
        setActiveChatSynced(fresh.id);
        onChatChange(record);
      } finally {
        isCreatingRef.current = false;
      }
    },
    [setActiveChatSynced, setChatsSynced],
  );

  const handleCloseChat = useCallback(
    async (id: string, onChatChange: (record: ChatRecord | null) => void) => {
      // Update local state immediately for better UX
      setChatsSynced((prev) => prev.filter((c) => c.id !== id));

      await window.vibe.chats.delete(id);
      const list = await window.vibe.chats.list();
      if (list.length === 0) {
        const fresh = await window.vibe.chats.new();
        if (fresh) {
          const record = await window.vibe.chats.open(fresh.id);
          setChatsSynced([fresh]);
          setActiveChatSynced(fresh.id);
          onChatChange(record);
        }
        return;
      }
      setChatsSynced(list);
      if (activeChatRef.current === id) {
        const next = list[0]!;
        const record = await window.vibe.chats.open(next.id);
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
