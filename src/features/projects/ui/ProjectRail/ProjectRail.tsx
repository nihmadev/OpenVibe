import type React from "react";
import { useState } from "react";
import { useI18n } from "@/shared/i18n/useI18n";
import { ContextMenu, type MenuItem } from "@/shared/ui/ContextMenu/ContextMenu";
import { Tooltip } from "@/shared/ui/Tooltip/Tooltip";
import type { Project } from "../../model/project";
import "./ProjectRail.css";
import { fsApi } from "@/features/files/infrastructure/fsGateway";

interface Props {
  projects: Project[];
  activeId: string | null;
  expanded: boolean;
  onPick: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
  onRemove: (id: string) => void;
  onToggleExpanded: () => void;
  onHover: (id: string | null) => void;
  onSettings: () => void;
  /** IDs of projects currently being animated out (folder missing). */
  removingIds?: Set<string>;
}

interface Ctx {
  x: number;
  y: number;
  project: Project;
}

function avatarDisplay(project: Project, fallback: number): string {
  if (project.photo) return "";
  if (project.icon) return project.icon;
  const t = project.name.trim();
  if (!t) return String(fallback + 1);
  const ch = t.replace(/[^\p{L}\p{N}]+/gu, "")[0];
  return ch ? ch.toUpperCase() : String(fallback + 1);
}

export function ProjectRail({
  projects,
  activeId,
  onPick,
  onAdd,
  onClose,
  onRemove,
  onHover,
  onSettings,
  removingIds,
}: Omit<Props, "expanded" | "onToggleExpanded">): React.ReactElement {
  const { t } = useI18n();
  const [ctx, setCtx] = useState<Ctx | null>(null);

  function buildItems(c: Ctx): MenuItem[] {
    const isActive = c.project.id === activeId;
    return [
      ...(isActive
        ? [
            {
              label: t("closeProject"),
              onClick: () => onClose(),
            },
          ]
        : []),
      {
        label: t("openProjectMenuItem"),
        disabled: isActive,
        onClick: () => onPick(c.project.id),
      },
      {
        label: t("revealExplorer"),
        onClick: () => fsApi.reveal(c.project.path),
      },
      {
        label: t("removeFromList"),
        danger: true,
        onClick: () => onRemove(c.project.id),
      },
    ];
  }

  return (
    <div className="project-rail">
      <div className="project-rail__list">
        {projects.map((p, i) => {
          const isActive = p.id === activeId;
          const isRemoving = removingIds?.has(p.id) ?? false;
          return (
            <button
              key={p.id}
              className={
                "project-rail__tile" +
                (isActive ? " project-rail__tile--active" : "") +
                (isRemoving ? " project-rail__tile--removing" : "")
              }
              onClick={() => !isRemoving && onPick(p.id)}
              onMouseEnter={() => !isRemoving && onHover(p.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!isRemoving) setCtx({ x: e.clientX, y: e.clientY, project: p });
              }}
              style={isActive ? ({ "--tile-color": p.color } as React.CSSProperties) : undefined}
              disabled={isRemoving}
            >
              <span className="project-rail__avatar" style={{ "--avatar-bg": p.color } as React.CSSProperties}>
                {p.photo ? <img src={p.photo} alt="" className="project-rail__avatar-img" /> : avatarDisplay(p, i)}
              </span>
            </button>
          );
        })}
      </div>
      <Tooltip text={t("openFolder")} side="right">
        <button className="project-rail__add" onClick={onAdd} aria-label={t("openFolder")}>
          +
        </button>
      </Tooltip>

      <div className="project-rail__bottom">
        <Tooltip text={t("settings")} side="right">
          <button className="project-rail__settings" aria-label={t("settings")} onClick={onSettings}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1.08 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1.08z" />
            </svg>
          </button>
        </Tooltip>
      </div>

      {ctx ? <ContextMenu x={ctx.x} y={ctx.y} items={buildItems(ctx)} onClose={() => setCtx(null)} /> : null}
    </div>
  );
}
