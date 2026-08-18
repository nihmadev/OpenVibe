import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/platform/localization/localizationService";
import type { TerminalViewProps } from "../../common/terminal";
import { TerminalPane } from "../terminalPane/terminalPane";
import "../../../../browser/parts/auxiliaryBar/terminalTabs.css";

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

export function TerminalView({ active }: TerminalViewProps): React.ReactElement {
  const { t } = useI18n();
  const [tabs, setTabs] = useState<Tab[]>(() => [makeTab(t)]);
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id);
  const tabsRef = useRef(tabs);
  const activeIdRef = useRef(activeId);
  tabsRef.current = tabs;
  activeIdRef.current = activeId;

  const addTab = useCallback((): void => {
    const tab = makeTab(t);
    setTabs((p) => [...p, tab]);
    setActiveId(tab.id);
  }, [t]);

  const switchTab = useCallback((dir: "prev" | "next"): void => {
    const list = tabsRef.current;
    if (list.length <= 1) return;
    const idx = list.findIndex((tab) => tab.id === activeIdRef.current);
    if (idx < 0) return;
    const nextIdx = dir === "next" ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
    setActiveId(list[nextIdx]?.id);
  }, []);

  const closeTabById = useCallback((id: string): void => {
    const prev = tabsRef.current;
    const idx = prev.findIndex((tab) => tab.id === id);
    if (idx === -1) return;

    if (prev.length <= 1) {
      window.dispatchEvent(new CustomEvent("vibe:close-terminal-panel"));
      return;
    }

    const next = prev.filter((tab) => tab.id !== id);
    setTabs(next);
    if (activeIdRef.current === id) {
      const fallback = next[Math.max(0, idx - 1)]!;
      setActiveId(fallback.id);
    }
  }, []);

  function closeTab(id: string, e: React.MouseEvent): void {
    e.stopPropagation();
    closeTabById(id);
  }

  const closeActiveTab = useCallback((): void => {
    if (activeIdRef.current) closeTabById(activeIdRef.current);
  }, [closeTabById]);

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
  }, [switchTab, closeActiveTab, addTab, closeTabById]);

  return (
    <div className="terminals">
      <div className="termtabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`termtabs__tab${tab.id === activeId ? " termtabs__tab--active" : ""}`}
            onClick={() => setActiveId(tab.id)}
            onMouseUp={(e) => {
              if (e.button === 1) closeTab(tab.id, e);
            }}
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
          <TerminalPane key={tab.id} id={tab.id} visible={active && tab.id === activeId} />
        ))}
      </div>
    </div>
  );
}
