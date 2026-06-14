import React, { useEffect, useState, useRef, useCallback } from "react";
import type { ChatSummary, Project } from "../../types.js";
import { SessionListItem } from "./SessionListItem.js";
import { useI18n } from "../../hooks/useI18n.js";
import "../../styles/SessionList.css";

interface SessionListProps {
  open: boolean;
  width: number;
  onResize: (width: number) => void;
  onResizingChange?: (resizing: boolean) => void;
  chats: ChatSummary[];
  activeId: string | null;
  workspace: string;
  workspaceLabel: string;
  onPick: (id: string, isMultiselect: boolean) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
  project?: Project | null;
  onProjectEdit?: (project: Project) => void;
  onProjectRemove?: (id: string) => void;
}

export function SessionList({
  open,
  width,
  onResize,
  onResizingChange,
  chats,
  activeId,
  workspace,
  workspaceLabel,
  onPick,
  onNew,
  onDelete,
  onClose,
  project,
  onProjectEdit,
  onProjectRemove,
}: SessionListProps): React.ReactElement {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localWidth, setLocalWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Sync local width with prop width when not resizing
  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(width);
    }
  }, [width, isResizing]);

  const handlePick = (id: string, isMultiselect: boolean) => {
    if (isMultiselect) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
    } else {
      setSelectedIds([]);
      onPick(id, false);
    }
  };

  const handleDelete = (id: string) => {
    if (selectedIds.length > 0 && selectedIds.includes(id)) {
      // Delete all selected sessions
      selectedIds.forEach((sid) => onDelete(sid));
      setSelectedIds([]);
    } else {
      onDelete(id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    onResizingChange?.(true);
    const startX = e.clientX;
    const startWidth = width;

    let currentWidth = startWidth;
    let animationFrameId: number | null = null;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      currentWidth = Math.max(150, Math.min(600, startWidth + delta));

      if (animationFrameId !== null) return;
      animationFrameId = requestAnimationFrame(() => {
        setLocalWidth(currentWidth);
        animationFrameId = null;
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      onResizingChange?.(false);
      onResize(currentWidth);
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const handleMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <div
      className={"session-list" + (open ? " session-list--open" : "") + (isResizing ? " session-list--resizing" : "")}
      style={{
        width: open ? `${localWidth}px` : "0px",
        minWidth: open ? `${localWidth}px` : "0px",
      }}
    >
      <div className="session-list__inner" style={{ width: `${localWidth}px` }}>
        <div className="session-list__resize-handle" onMouseDown={handleMouseDown} />

        <div className="session-list__head">
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "4px",
              marginBottom: "12px",
              marginTop: "4px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="session-list__name">{workspaceLabel}</div>
              <div className="session-list__path">{workspace}</div>
            </div>
            {project ? (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <button className="session-list__menu-btn" onClick={handleMenuToggle} aria-label="Project menu">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                    <circle cx="8" cy="3" r="1.5" />
                    <circle cx="8" cy="8" r="1.5" />
                    <circle cx="8" cy="13" r="1.5" />
                  </svg>
                </button>
                {menuOpen ? (
                  <div className="session-list__dropdown" ref={menuRef}>
                    <button
                      className="session-list__dropdown-item"
                      onClick={() => {
                        onProjectEdit?.(project);
                        setMenuOpen(false);
                      }}
                    >
                      {t("editProject")}
                    </button>
                    <button
                      className="session-list__dropdown-item session-list__dropdown-item--danger"
                      onClick={() => {
                        onProjectRemove?.(project.id);
                        setMenuOpen(false);
                      }}
                    >
                      {t("closeFromList")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <button className="session-list__newsession" onClick={onNew}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 3v10M3 8h10" />
            </svg>
            {t("newSession")}
          </button>
        </div>

        <div className="session-list__list">
          {chats.length === 0 ? (
            <div className="session-list__empty">{t("noSessions")}</div>
          ) : (
            chats.map((c) => (
              <SessionListItem
                key={c.id}
                chat={c}
                active={c.id === activeId}
                selected={selectedIds.includes(c.id)}
                onPick={(isMultiselect) => handlePick(c.id, isMultiselect)}
                onDelete={() => handleDelete(c.id)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
