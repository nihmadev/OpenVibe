import React, { useState, useRef, useMemo, useEffect, useCallback } from "react";
import "../../styles/SearchPopup.css";
import { SearchIcon, FileIcon, FolderIcon } from "../icons/index.js";
import type { FileMatch } from "../../types.js";
import { useI18n } from "../../hooks/useI18n.js";
import { filterCommands } from "./commands.js";

interface SearchPopupProps {
  folder: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSwitchChat: (direction: "prev" | "next") => void;
  onToggleTerminal: () => void;
  onOpenFile?: (path: string) => void;
  onRevealFolder?: (path: string) => void;
  onCommand?: (id: string) => void;
}

interface ActionItem {
  id: string;
  label: string;
  shortcut: string;
  action: () => void;
}

function makeActions(t: (key: any) => string): ActionItem[] {
  return [
    { id: "new-session", label: t("newSession"), shortcut: "Ctrl+N", action: () => {} },
    { id: "prev-session", label: t("prevSession"), shortcut: "Ctrl+Shift+Tab", action: () => {} },
    { id: "next-session", label: t("nextSession"), shortcut: "Ctrl+Tab", action: () => {} },
    { id: "open-terminal", label: t("openTerminal"), shortcut: "Ctrl+`", action: () => {} },
  ];
}

export function SearchPopup({
  folder,
  onClose,
  onNewChat,
  onSwitchChat,
  onToggleTerminal,
  onOpenFile,
  onRevealFolder,
  onCommand,
}: SearchPopupProps): React.ReactElement {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<FileMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const actions = makeActions(t).map((a) => {
    if (a.id === "new-session") return { ...a, action: onNewChat };
    if (a.id === "prev-session") return { ...a, action: () => onSwitchChat("prev") };
    if (a.id === "next-session") return { ...a, action: () => onSwitchChat("next") };
    if (a.id === "open-terminal") return { ...a, action: onToggleTerminal };
    return a;
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const commandMatches = useMemo(() => filterCommands(query), [query]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!query.trim() || !folder) {
      setMatches([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const res = await window.vibe.fs.findAll(folder, query, 50);
      if (res.ok) {
        setMatches(res.matches);
      }
      setLoading(false);
    }, 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, folder]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const showingResults = query.trim().length > 0;
  const totalItems = showingResults ? commandMatches.length + matches.length : actions.length;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i < totalItems - 1 ? i + 1 : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => (i > 0 ? i - 1 : totalItems - 1));
      } else if (e.key === "Enter" && selectedIdx >= 0 && selectedIdx < totalItems) {
        e.preventDefault();
        if (showingResults) {
          if (selectedIdx < commandMatches.length) {
            onCommand?.(commandMatches[selectedIdx]!.id);
          } else {
            const fileIdx = selectedIdx - commandMatches.length;
            if (fileIdx < matches.length) {
              const m = matches[fileIdx]!;
              if (m.isDir) {
                onRevealFolder?.(m.path);
              } else {
                onOpenFile?.(m.path);
              }
            }
          }
          onClose();
        } else if (selectedIdx < actions.length) {
          actions[selectedIdx]!.action();
          onClose();
        }
      }
    },
    [
      commandMatches,
      matches,
      actions,
      selectedIdx,
      totalItems,
      showingResults,
      onClose,
      onOpenFile,
      onRevealFolder,
      onCommand,
    ],
  );

  return (
    <div className="search-popup__overlay" onClick={onClose}>
      <div className="search-popup" onClick={(e) => e.stopPropagation()}>
        <div className="search-popup__header">
          <SearchIcon />
          <input
            ref={inputRef}
            className="search-popup__input"
            type="text"
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(-1);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="search-popup__body">
          {showingResults ? (
            <>
              {commandMatches.map((cmd, i) => (
                <div
                  key={cmd.id}
                  className={
                    "search-popup__result-item search-popup__result-item--cmd" +
                    (i === selectedIdx ? " search-popup__result-item--active" : "")
                  }
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => {
                    onCommand?.(cmd.id);
                    onClose();
                  }}
                >
                  <span className="search-popup__cmd-label">{t(cmd.labelKey as any)}</span>
                  {cmd.shortcut && <span className="search-popup__cmd-kbd">{cmd.shortcut}</span>}
                </div>
              ))}
              {commandMatches.length > 0 && matches.length > 0 && <div className="search-popup__separator" />}
              {matches.map((m, i) => {
                const idx = commandMatches.length + i;
                return (
                  <div
                    key={m.path}
                    className={
                      "search-popup__result-item" + (idx === selectedIdx ? " search-popup__result-item--active" : "")
                    }
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => {
                      if (m.isDir) {
                        onRevealFolder?.(m.path);
                      } else {
                        onOpenFile?.(m.path);
                      }
                      onClose();
                    }}
                  >
                    {m.isDir ? <FolderIcon open={false} name={m.name} /> : <FileIcon name={m.name} />}
                    <span className="search-popup__result-path">{m.rel}</span>
                  </div>
                );
              })}
              {!loading && commandMatches.length === 0 && matches.length === 0 && (
                <div className="search-popup__status">{t("noMatches")}</div>
              )}
              {loading && commandMatches.length === 0 && matches.length === 0 && (
                <div className="search-popup__status">{t("searching")}</div>
              )}
            </>
          ) : (
            <div className="search-popup__footer">
              {actions.map((a, i) => (
                <div
                  key={a.id}
                  className={
                    "search-popup__action-row" + (i === selectedIdx ? " search-popup__action-row--active" : "")
                  }
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => {
                    a.action();
                    onClose();
                  }}
                >
                  <span className="search-popup__action-label">{a.label}</span>
                  <span className="search-popup__action-kbd">{a.shortcut}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
