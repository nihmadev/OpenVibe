import { Button, IconButton, Input, Select, surfaceClassName, Toggle } from "@zazaru/ui";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon, PlusSmallIcon, SearchMiniIcon, TrashIcon } from "@/base/browser/ui/icons/iconRegistry";
import type { ScheduledTasksViewProps } from "../../common/scheduledTask";
import { useScheduledTasks } from "../schedulerStore";
import "./scheduledTasksView.css";

const TIME_OPTIONS = [
  { value: "6:00 AM", label: "6:00 AM" },
  { value: "7:00 AM", label: "7:00 AM" },
  { value: "8:00 AM", label: "8:00 AM" },
  { value: "9:00 AM", label: "9:00 AM" },
  { value: "10:00 AM", label: "10:00 AM" },
  { value: "11:00 AM", label: "11:00 AM" },
  { value: "12:00 PM", label: "12:00 PM" },
  { value: "1:00 PM", label: "1:00 PM" },
  { value: "2:00 PM", label: "2:00 PM" },
  { value: "3:00 PM", label: "3:00 PM" },
  { value: "4:00 PM", label: "4:00 PM" },
  { value: "5:00 PM", label: "5:00 PM" },
  { value: "6:00 PM", label: "6:00 PM" },
  { value: "7:00 PM", label: "7:00 PM" },
  { value: "8:00 PM", label: "8:00 PM" },
  { value: "9:00 PM", label: "9:00 PM" },
  { value: "10:00 PM", label: "10:00 PM" },
  { value: "11:00 PM", label: "11:00 PM" },
  { value: "12:00 AM", label: "12:00 AM" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekly", label: "Weekly" },
  { value: "hourly", label: "Hourly" },
  { value: "monthly", label: "Monthly" },
];

export function ScheduledTasksView({
  activeProjectId,
  projectName = "OpenVibe",
  projects = [],
}: ScheduledTasksViewProps): React.ReactElement {
  const { tasks, addTask, deleteTask, toggleTask, runTaskNow } = useScheduledTasks();
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // New Scheduled Task Form State
  const [name, setName] = useState("");
  const [selectedProject, setSelectedProject] = useState(activeProjectId || "default");
  const [frequency, setFrequency] = useState("daily");
  const [time, setTime] = useState("9:00 AM");
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCreateOpen) {
        setIsCreateOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateOpen]);

  const projectOptions = useMemo(() => {
    const defaultOpt = [{ value: "default", label: projectName || "OpenVibe" }];
    const otherOpts = projects.filter((p) => p.name !== projectName).map((p) => ({ value: p.id, label: p.name }));
    return [...defaultOpt, ...otherOpts];
  }, [projects, projectName]);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.prompt.toLowerCase().includes(q) ||
        t.projectName?.toLowerCase().includes(q),
    );
  }, [tasks, search]);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const chosenProj = projects.find((p) => p.id === selectedProject);
    const chosenName = chosenProj ? chosenProj.name : projectName;

    let hour = 9;
    let minute = 0;
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1] ?? "9", 10);
      const m = parseInt(match[2] ?? "0", 10);
      const isPm = match[3]?.toUpperCase() === "PM";
      if (isPm && h < 12) h += 12;
      if (!isPm && h === 12) h = 0;
      hour = h;
      minute = m;
    }

    let cronExp = `${minute} ${hour} * * *`;
    if (frequency === "weekdays") cronExp = `${minute} ${hour} * * 1-5`;
    else if (frequency === "weekly") cronExp = `${minute} ${hour} * * 1`;
    else if (frequency === "hourly") cronExp = `0 * * * *`;
    else if (frequency === "monthly") cronExp = `${minute} ${hour} 1 * *`;

    addTask({
      title: name.trim() || prompt.trim().slice(0, 35) || "Scheduled Task",
      prompt: prompt.trim(),
      scheduleType: "cron",
      cronExpression: cronExp,
      projectId: selectedProject !== "default" ? selectedProject : null,
      projectName: chosenName,
      enabled: true,
    });

    setName("");
    setPrompt("");
    setIsCreateOpen(false);
  };

  return (
    <div className={surfaceClassName("canvas", "sched-view-root")}>
      <div className="sched-view-container">
        {/* Header */}
        <div className="sched-view__header">
          <h1 className="sched-view__title">Scheduled Tasks</h1>
          <Button variant="secondary" className="sched-view__new-btn" onClick={() => setIsCreateOpen(true)}>
            <PlusSmallIcon />
            <span>New</span>
          </Button>
        </div>

        {/* Search bar */}
        <div className="sched-view__search-wrap">
          <SearchMiniIcon size={14} className="sched-view__search-icon" />
          <input
            type="text"
            className="sched-view__search-input"
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="sched-view__content">
          {filteredTasks.length === 0 ? (
            <div className="sched-view__empty">No scheduled tasks configured.</div>
          ) : (
            <div className="sched-view__list">
              {filteredTasks.map((t) => (
                <div key={t.id} className="sched-view__item">
                  <div className="sched-view__item-info">
                    <div className="sched-view__item-title-row">
                      <span className="sched-view__item-title">{t.title}</span>
                      <span className="sched-view__item-cron">{t.cronExpression || "Daily at 9:00 AM"}</span>
                    </div>
                    <div className="sched-view__item-prompt">{t.prompt}</div>
                  </div>

                  <div className="sched-view__item-actions">
                    <Button variant="secondary" className="sched-view__item-run" onClick={() => runTaskNow(t.id)}>
                      Run
                    </Button>
                    <Toggle checked={t.enabled} onValueChange={() => toggleTask(t.id)} />
                    <IconButton
                      className="sched-view__item-delete"
                      onClick={() => deleteTask(t.id)}
                      title="Delete task"
                      aria-label="Delete task"
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Scheduled Task Dialog (Themed Surface Modal) */}
      {isCreateOpen && (
        <div className="sched-create-modal__backdrop" onClick={() => setIsCreateOpen(false)}>
          <div className={surfaceClassName("panel", "sched-create-modal")} onClick={(e) => e.stopPropagation()}>
            <div className="sched-create-modal__header">
              <h2 className="sched-create-modal__title">New Scheduled Task</h2>
              <IconButton
                className="sched-create-modal__close"
                onClick={() => setIsCreateOpen(false)}
                title="Close"
                aria-label="Close"
              >
                <CloseIcon />
              </IconButton>
            </div>

            <form onSubmit={handleCreateTask} className="sched-create-modal__form">
              {/* Name */}
              <div className="sched-create-modal__field">
                <label className="sched-create-modal__label">Name</label>
                <Input
                  placeholder="Enter scheduled task name..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              {/* Project */}
              <div className="sched-create-modal__field">
                <label className="sched-create-modal__label">Project</label>
                <Select value={selectedProject} options={projectOptions} onChange={(val) => setSelectedProject(val)} />
              </div>

              {/* Schedule */}
              <div className="sched-create-modal__field">
                <label className="sched-create-modal__label">Schedule</label>
                <div className="sched-create-modal__schedule-row">
                  <Select value={frequency} options={FREQUENCY_OPTIONS} onChange={(val) => setFrequency(val)} />

                  <span className="sched-create-modal__around">around</span>

                  <Select value={time} options={TIME_OPTIONS} onChange={(val) => setTime(val)} />
                </div>
              </div>

              {/* Prompt */}
              <div className="sched-create-modal__field">
                <label className="sched-create-modal__label">Prompt</label>
                <textarea
                  className="sched-create-modal__textarea"
                  placeholder="Enter a prompt for the agent to run..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {/* Footer */}
              <div className="sched-create-modal__footer">
                <span className="sched-create-modal__note">All scheduled tasks run as Flash.</span>
                <Button type="submit" variant="primary" className="sched-create-modal__submit-btn">
                  Add Scheduled Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
