import type React from "react";
import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/features/projects/model/project";
import { useI18n } from "@/shared/i18n/useI18n";
import { KebabMenuIcon, PlusSmallIcon } from "@/shared/icons/icons";
import { ContextMenu } from "@/shared/ui/ContextMenu/ContextMenu";
import { interactiveListClassName } from "@/shared/ui/kit";
import type { ChatSummary } from "../../model/chat";
import { SessionListItem } from "./SessionListItem";
import "./SessionList.css";

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
  onClose: _onClose,
  project,
  onProjectEdit,
  onProjectRemove,
}: SessionListProps): React.ReactElement {
  const { t } = useI18n();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [localWidth, setLocalWidth] = useState(width);
  const [isResizing, setIsResizing] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

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
      selectedIds.forEach((sid) => {
        onDelete(sid);
      });
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
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPos((prev) => (prev ? null : { x: rect.right, y: rect.bottom + 4 }));
  }, []);

  return (
    <div
      className={`session-list${open ? " session-list--open" : ""}${isResizing ? " session-list--resizing" : ""}`}
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
                <button
                  className="ui-icon-btn ui-icon-btn--sm session-list__menu-btn"
                  onClick={handleMenuToggle}
                  aria-label="Project menu"
                >
                  <KebabMenuIcon />
                </button>
                {menuPos ? (
                  <ContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    onClose={() => setMenuPos(null)}
                    items={[
                      { label: t("editProject"), onClick: () => onProjectEdit?.(project) },
                      { label: t("closeFromList"), danger: true, onClick: () => onProjectRemove?.(project.id) },
                    ]}
                  />
                ) : null}
              </div>
            ) : null}
          </div>

          <button className="session-list__newsession" onClick={onNew}>
            <PlusSmallIcon />
            {t("newSession")}
          </button>
        </div>

        <div className={interactiveListClassName("session-list__list")}>
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
