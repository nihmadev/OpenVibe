import { useEffect, useState } from "react";
import type { ScheduledTask } from "../common/scheduledTask";
import { computeNextRun } from "../common/scheduledTask";

const STORAGE_KEY = "openvibe:scheduled_tasks:v1";

function loadTasks(): ScheduledTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultTasks();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getDefaultTasks();
  } catch {
    return getDefaultTasks();
  }
}

function saveTasks(tasks: ScheduledTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    /* ignore storage quota */
  }
}

function getDefaultTasks(): ScheduledTask[] {
  return [];
}

type Listener = () => void;
const listeners = new Set<Listener>();
let currentTasks = loadTasks();

function notify() {
  saveTasks(currentTasks);
  listeners.forEach((listener) => {
    listener();
  });
}

export function addTask(data: Omit<ScheduledTask, "id" | "createdAt" | "runCount" | "nextRunAt">): ScheduledTask {
  const id = `sched-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const nextRunAt = computeNextRun(data);
  const newTask: ScheduledTask = {
    ...data,
    id,
    createdAt: Date.now(),
    runCount: 0,
    nextRunAt,
  };
  currentTasks = [newTask, ...currentTasks];
  notify();
  return newTask;
}

export function updateTask(id: string, updates: Partial<ScheduledTask>): void {
  currentTasks = currentTasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
  notify();
}

export function deleteTask(id: string): void {
  currentTasks = currentTasks.filter((t) => t.id !== id);
  notify();
}

export function toggleTask(id: string): void {
  currentTasks = currentTasks.map((t) => {
    if (t.id === id) {
      const nextEnabled = !t.enabled;
      const nextRunAt = nextEnabled ? computeNextRun(t) : t.nextRunAt;
      return { ...t, enabled: nextEnabled, nextRunAt };
    }
    return t;
  });
  notify();
}

export function runTaskNow(id: string): void {
  const task = currentTasks.find((t) => t.id === id);
  if (!task) return;

  const now = Date.now();
  const nextRun = computeNextRun(task);

  currentTasks = currentTasks.map((t) =>
    t.id === id
      ? {
          ...t,
          lastRunAt: now,
          runCount: t.runCount + 1,
          nextRunAt: nextRun,
          lastStatus: "success",
        }
      : t,
  );
  notify();

  // Dispatch custom event so application or agent chat can pick it up
  window.dispatchEvent(
    new CustomEvent("openvibe:trigger-scheduled-task", {
      detail: { task },
    }),
  );
}

export function useScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTask[]>(currentTasks);

  useEffect(() => {
    const handler = () => setTasks([...currentTasks]);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    tasks,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    runTaskNow,
  };
}
