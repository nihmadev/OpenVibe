import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type React from "react";
import {
  CodexProgressDonut,
  CodexTodoCompletedIcon,
  CodexTodoPendingIcon,
  CodexTodoProgressIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import type { TodoTask } from "@/workbench/common/conversation";
import "./todo.css";
import type { TodoViewProps } from "../../common/chat";

function StatusIcon({ status }: { status: TodoTask["status"] }): React.ReactElement {
  if (status === "completed") return <CodexTodoCompletedIcon />;
  if (status === "in_progress") return <CodexTodoProgressIcon className="todo-card__spinner" />;
  return <CodexTodoPendingIcon />;
}

export function TodoView({ tasks, active = true, changeSummary }: TodoViewProps): React.ReactElement | null {
  const { t, lang } = useI18n();
  const reducedMotion = useReducedMotion();
  const inProgressIndex = tasks.findIndex((task) => task.status === "in_progress");
  const unfinishedIndex = tasks.findIndex((task) => task.status !== "completed");
  const currentIndex = Math.max(
    0,
    inProgressIndex >= 0 ? inProgressIndex : unfinishedIndex >= 0 ? unfinishedIndex : tasks.length - 1,
  );
  const completed = tasks.filter((task) => task.status === "completed").length;
  const percent = tasks.length === 0 ? 0 : (completed / tasks.length) * 100;

  if (tasks.length === 0) return null;

  const progressLabel = t("todoStep", { stepNumber: currentIndex + 1, stepCount: tasks.length });
  const numberFormatter = new Intl.NumberFormat(lang === "Russian" ? "ru-RU" : "en-US");
  const changeLabel = changeSummary ? t("todoFilesChanged", { count: changeSummary.fileCount }) : "";

  return (
    <AnimatePresence initial={false}>
      {active && (
        <motion.div
          className="todo-widget"
          initial={reducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.15, ease: "easeOut" }}
          layout={!reducedMotion}
        >
          <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0}>
            <TooltipPrimitive.Root>
              <TooltipPrimitive.Trigger asChild>
                <button
                  className="todo-widget__button"
                  type="button"
                  aria-label={`${progressLabel}${changeLabel ? `. ${changeLabel}` : ""}. ${t("todoProgress", { completed, count: tasks.length })}`}
                >
                  <CodexProgressDonut className="todo-widget__donut" percent={percent} />
                  <span className="todo-widget__progress-label">{progressLabel}</span>
                  {changeSummary && (
                    <>
                      <span className="todo-widget__separator" aria-hidden="true">
                        ·
                      </span>
                      <span className="todo-widget__changes">{changeLabel}</span>
                      <span className="todo-widget__lines todo-widget__lines--added">
                        +{numberFormatter.format(changeSummary.added)}
                      </span>
                      <span className="todo-widget__lines todo-widget__lines--removed">
                        -{numberFormatter.format(changeSummary.removed)}
                      </span>
                    </>
                  )}
                </button>
              </TooltipPrimitive.Trigger>
              <TooltipPrimitive.Portal>
                <TooltipPrimitive.Content
                  side="top"
                  align="center"
                  sideOffset={8}
                  collisionPadding={8}
                  className="todo-card"
                >
                  <div className="todo-card__list" role="list" aria-label={t("todoTitle")}>
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
                </TooltipPrimitive.Content>
              </TooltipPrimitive.Portal>
            </TooltipPrimitive.Root>
          </TooltipPrimitive.Provider>
          <span className="todo-widget__live" aria-live="polite">
            {t("todoProgress", { completed, count: tasks.length })}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
