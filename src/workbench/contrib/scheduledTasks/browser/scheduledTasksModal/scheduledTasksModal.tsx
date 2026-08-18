import type React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  CloseIcon,
  FolderTreeIcon,
  PlusSmallIcon,
  SearchMiniIcon,
  TrashIcon,
} from "@/base/browser/ui/icons/iconRegistry";
import { useScheduledTasks } from "../schedulerStore";
import "./scheduledTasksModal.css";

interface ScheduledTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProjectId?: string | null;
  projectName?: string;
  projects?: { id: string; name: string }[];
}

const TIME_OPTIONS = [
  "6:00 AM",
  "7:00 AM",
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
  "12:00 AM",
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekdays", label: "Weekdays (Mon-Fri)" },
  { value: "weekly", label: "Weekly" },
  { value: "hourly", label: "Hourly" },
  { value: "monthly", label: "Monthly" },
];

export function ScheduledTasksModal({
  isOpen,
  onClose,
  activeProjectId,
  projectName = "OpenVibe",
  projects = [],
}: ScheduledTasksModalProps): React.ReactElement | null {
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
    if (!isOpen) {
      setIsCreateOpen(false);
      setSearch("");
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isCreateOpen) setIsCreateOpen(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isCreateOpen, onClose]);

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

  if (!isOpen) return null;

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const chosenProj = projects.find((p) => p.id === selectedProject);
    const chosenName = chosenProj ? chosenProj.name : projectName;

    // Convert frequency & time to cron
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
    <div className="sched-page-overlay" onClick={onClose}>
      <div className="sched-page-container" onClick={(e) => e.stopPropagation()}>
        {/* Main Background Scheduled Tasks View (Screenshot 2) */}
        <div className="sched-view">
          <div className="sched-view__header">
            <h1 className="sched-view__title">Scheduled Tasks</h1>
            <button type="button" className="sched-view__new-btn" onClick={() => setIsCreateOpen(true)}>
              <PlusSmallIcon />
              <span>New</span>
            </button>
          </div>

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
                      <button type="button" className="sched-view__item-run" onClick={() => runTaskNow(t.id)}>
                        Run
                      </button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={t.enabled}
                        className={`sched-view__switch${t.enabled ? " sched-view__switch--on" : ""}`}
                        onClick={() => toggleTask(t.id)}
                      >
                        <span className="sched-view__switch-thumb" />
                      </button>
                      <button type="button" className="sched-view__item-delete" onClick={() => deleteTask(t.id)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* New Scheduled Task Modal (Screenshot 1) */}
        {isCreateOpen && (
          <div className="sched-create-modal__backdrop" onClick={() => setIsCreateOpen(false)}>
            <div className="sched-create-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sched-create-modal__header">
                <h2 className="sched-create-modal__title">New Scheduled Task</h2>
                <button type="button" className="sched-create-modal__close" onClick={() => setIsCreateOpen(false)}>
                  <CloseIcon />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="sched-create-modal__form">
                {/* Name */}
                <div className="sched-create-modal__field">
                  <label className="sched-create-modal__label">Name</label>
                  <input
                    type="text"
                    className="sched-create-modal__input"
                    placeholder="Enter scheduled task name..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    // biome-ignore lint/a11y/noAutofocus: opening the create dialog should place focus in its primary field
                    autoFocus
                  />
                </div>

                {/* Project */}
                <div className="sched-create-modal__field">
                  <label className="sched-create-modal__label">Project</label>
                  <div className="sched-create-modal__select-wrap">
                    <FolderTreeIcon size={14} className="sched-create-modal__field-icon" />
                    <select
                      className="sched-create-modal__select"
                      value={selectedProject}
                      onChange={(e) => setSelectedProject(e.target.value)}
                    >
                      <option value="default">{projectName || "OpenVibe"}</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="sched-create-modal__chevron" />
                  </div>
                </div>

                {/* Schedule */}
                <div className="sched-create-modal__field">
                  <label className="sched-create-modal__label">Schedule</label>
                  <div className="sched-create-modal__schedule-row">
                    <div className="sched-create-modal__select-wrap sched-create-modal__select-wrap--freq">
                      <select
                        className="sched-create-modal__select"
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                      >
                        {FREQUENCY_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="sched-create-modal__chevron" />
                    </div>

                    <span className="sched-create-modal__around">around</span>

                    <div className="sched-create-modal__select-wrap sched-create-modal__select-wrap--time">
                      <select
                        className="sched-create-modal__select"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                      >
                        {TIME_OPTIONS.map((tOpt) => (
                          <option key={tOpt} value={tOpt}>
                            {tOpt}
                          </option>
                        ))}
                      </select>
                      <ChevronDownIcon className="sched-create-modal__chevron" />
                    </div>
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
                  <button type="submit" className="sched-create-modal__submit-btn">
                    Add Scheduled Task
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
