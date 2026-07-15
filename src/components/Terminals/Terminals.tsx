import React, { useState, useEffect, useRef, useCallback } from "react";
import { TermPane } from "../TermPane/TermPane.js";
import { useI18n } from "../../hooks/useI18n.js";
import "../../styles/Terminals.css";

interface Tab {
  id: string;
  title: string;
}

let nextNum = 0;

function makeTab(t: (key: string, params?: Record<string, string>) => string): Tab {
  nextNum += 1;
  const id = `t${Date.now().toString(36)}-${nextNum}`;
  return { id, title: t("terminalTab", { num: String(nextNum) }) };
}

interface TerminalsProps {
  /** Whether the parent view is currently visible. */
  active: boolean;
}

export function Terminals({ active }: TerminalsProps): React.ReactElement {
  const { t } = useI18n();
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab(t)]);
  const [activeId, setActiveId] = useState<string>(tabs[0]!.id);
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);
  tabsRef.current = tabs;
  activeIdRef.current = activeId;

  function addTab(): void {
    const tab = makeTab(t);
    setTabs((p) => [...p, tab]);
    setActiveId(tab.id);
  }

  const switchTab = useCallback((dir: "prev" | "next"): void => {
    const list = tabsRef.current;
    if (list.length <= 1) return;
    const idx = list.findIndex((tab) => tab.id === activeIdRef.current);
    if (idx < 0) return;
    const nextIdx = dir === "next" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
    setActiveId(list[nextIdx]!.id);
  }, []);

  function closeTabById(id: string): void {
    setTabs((prev) => {
      const idx = prev.findIndex((tab) => tab.id === id);
      if (idx === -1) return prev;
      const next = prev.filter((tab) => tab.id !== id);
      if (next.length === 0) {
        const fresh = makeTab(t);
        setActiveId(fresh.id);
        return [fresh];
      }
      if (activeIdRef.current === id) {
        const fallback = next[Math.max(0, idx - 1)]!;
        setActiveId(fallback.id);
      }
      return next;
    });
  }

  function closeTab(id: string, e: React.MouseEvent): void {
    e.stopPropagation();
    closeTabById(id);
  }

  const closeActiveTab = useCallback((): void => {
    if (activeIdRef.current) closeTabById(activeIdRef.current);
  }, []);

  useEffect(() => {
    function onNew() {
      addTab();
    }
    function onSwitch(e: Event) {
      const detail = (e as CustomEvent).detail as { dir: "prev" | "next" } | undefined;
      switchTab(detail?.dir ?? "next");
    }
    function onClose() {
      closeActiveTab();
    }
    function onCloseById(e: Event) {
      const detail = (e as CustomEvent).detail as { id: string } | undefined;
      if (detail?.id) closeTabById(detail.id);
    }
    window.addEventListener("vibe:new-terminal", onNew);
    window.addEventListener("vibe:switch-terminal", onSwitch);
    window.addEventListener("vibe:close-terminal", onClose);
    window.addEventListener("vibe:close-terminal-by-id", onCloseById);
    return () => {
      window.removeEventListener("vibe:new-terminal", onNew);
      window.removeEventListener("vibe:switch-terminal", onSwitch);
      window.removeEventListener("vibe:close-terminal", onClose);
      window.removeEventListener("vibe:close-terminal-by-id", onCloseById);
    };
  }, [switchTab, closeActiveTab]);

  return (
    <div className="terminals">
      <div className="termtabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={"termtabs__tab" + (tab.id === activeId ? " termtabs__tab--active" : "")}
            onClick={() => setActiveId(tab.id)}
          >
            <span className="termtabs__title">{tab.title}</span>
            <button
              className="termtabs__close"
              onClick={(e) => closeTab(tab.id, e)}
              title={t("close")}
              aria-label={t("closeTab")}
            >
              ×
            </button>
          </div>
        ))}
        <button className="termtabs__new" onClick={addTab} title={t("newTerminal")}>
          +
        </button>
      </div>
      <div className="terminals__panes">
        {tabs.map((tab) => (
          <TermPane key={tab.id} id={tab.id} visible={active && tab.id === activeId} />
        ))}
      </div>
    </div>
  );
}
