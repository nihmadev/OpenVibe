import React, { useState } from "react";
import { ArrowRight, Check, Circle } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.js";
import type { TodoTask } from "../AgentChat/types.js";
import "./Todo.css";

interface TodoProps {
  tasks: TodoTask[];
}

function StatusIcon({ status }: { status: TodoTask["status"] }): React.ReactElement {
  const props = { size: 14, strokeWidth: 2, "aria-hidden": true } as const;
  if (status === "completed") return <Check {...props} />;
  if (status === "in_progress") return <ArrowRight {...props} />;
  return <Circle {...props} />;
}

export function Todo({ tasks }: TodoProps): React.ReactElement | null {
  const { t } = useI18n();
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const completed = tasks.filter((task) => task.status === "completed").length;
  const progress = tasks.length === 0 ? 0 : completed / tasks.length;
  const activeTasks = tasks.filter((task) => task.status === "in_progress");
  const activeTask = activeTasks[0];
  const open = hovered || pinned;

  if (tasks.length === 0) return null;

  return (
    <div
      className={`todo-widget${open ? " todo-widget--open" : ""}`}
      onPointerEnter={(event) => event.pointerType === "mouse" && setHovered(true)}
      onPointerLeave={(event) => event.pointerType === "mouse" && setHovered(false)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false);
      }}
    >
      <div className="todo-widget__reveal" aria-hidden={!open}>
        <div className="todo-widget__reveal-inner">
          <section className="todo-card" aria-label={t("todoTitle")}>
            <header className="todo-card__header">
              <span>{t("todoTitle")}</span>
              <span className="todo-card__count">{t("todoCount", { completed, count: tasks.length })}</span>
            </header>

            <div className="todo-card__list" role="list">
              {tasks.map((task, index) => (
                <div
                  className={`todo-card__task todo-card__task--${task.status}`}
                  key={task.id || `${index}-${task.title}`}
                  role="listitem"
                >
                  <span className="todo-card__status" aria-hidden="true">
                    <StatusIcon status={task.status} />
                  </span>
                  <span className="todo-card__task-title">{task.title}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <button
        className={`todo-widget__button${pinned ? " todo-widget__button--pinned" : ""}`}
        type="button"
        onClick={() => setPinned((value) => !value)}
        onFocus={() => setHovered(true)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          setPinned(false);
          setHovered(false);
          event.currentTarget.blur();
        }}
        aria-expanded={open}
        aria-pressed={pinned}
        aria-label={`${t(pinned ? "todoUnpin" : "todoPin")}. ${t("todoProgress", { completed, count: tasks.length })}`}
        title={t(pinned ? "todoUnpin" : "todoPin")}
      >
        <span
          className="todo-widget__progress"
          style={{ "--todo-progress": `${progress * 360}deg` } as React.CSSProperties}
          aria-hidden="true"
        >
          <span>{tasks.length}</span>
        </span>
        <span className="todo-widget__active-task">
          {activeTask
            ? `${activeTask.title}${activeTasks.length > 1 ? ` (+${activeTasks.length - 1})` : ""}`
            : t("todoTitle")}
        </span>
      </button>

      <span className="todo-widget__live" aria-live="polite">
        {t("todoProgress", { completed, count: tasks.length })}
      </span>
    </div>
  );
}
