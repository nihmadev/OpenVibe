import { IconButton } from "@zazaru/ui";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ContextMenu } from "@/base/browser/ui/contextMenu/contextMenu";
import { KebabMenuIcon, PlusSmallIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useScrollMask } from "@/base/browser/ui/useScrollMask";
import { useI18n } from "@/platform/localization/localizationService";
import type { Project } from "@/workbench/services/workspace/common/workspace";
import type { ChatSummary } from "../../../../services/chat/common/chat";
import { groupSessionsByDate } from "../../../../services/chat/common/chatDateGrouping";
import { SessionListItem } from "./sessionListItem";
import "./sessionList.css";

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

  const { ref: listScrollRef, maskStyle } = useScrollMask<HTMLDivElement>();

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
      currentWidth = Math.max(180, Math.min(600, startWidth + delta));

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

  const dateGroups = useMemo(() => {
    return groupSessionsByDate(chats, "last_updated");
  }, [chats]);

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
          <div className="session-list__head-top">
            <div className="session-list__info">
              <div className="session-list__name">{workspaceLabel}</div>
              <div className="session-list__path">{workspace}</div>
            </div>
            {project ? (
              <div className="session-list__menu-wrap">
                <IconButton
                  scale="compact"
                  className="session-list__menu-btn"
                  onClick={handleMenuToggle}
                  aria-label="Project menu"
                >
                  <KebabMenuIcon />
                </IconButton>
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
            <span>{t("newSession")}</span>
          </button>
        </div>

        <div ref={listScrollRef} className="session-list__list" style={maskStyle}>
          {chats.length === 0 ? (
            <div className="session-list__empty">{t("noSessions")}</div>
          ) : (
            dateGroups.map((group) => (
              <div key={group.key} className="session-list__group">
                <div className="session-list__group-title">{t(group.labelId as any) || group.labelId}</div>
                <div className="session-list__group-items">
                  {group.items.map((c) => (
                    <SessionListItem
                      key={c.id}
                      chat={c}
                      active={c.id === activeId}
                      selected={selectedIds.includes(c.id)}
                      onPick={(isMultiselect) => handlePick(c.id, isMultiselect)}
                      onDelete={() => handleDelete(c.id)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
