export type ScheduleType = "interval" | "cron" | "timer";

export interface ScheduledTask {
  id: string;
  title: string;
  prompt: string;
  scheduleType: ScheduleType;
  intervalMinutes?: number;
  cronExpression?: string;
  durationSeconds?: number;
  projectId: string | null;
  projectName?: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  nextRunAt: number;
  runCount: number;
  maxIterations?: number;
  lastStatus?: "success" | "error" | "running";
  lastError?: string;
}

export function computeNextRun(task: Omit<ScheduledTask, "id" | "createdAt" | "runCount" | "nextRunAt">): number {
  const now = Date.now();
  if (task.scheduleType === "timer" && task.durationSeconds) {
    return now + task.durationSeconds * 1000;
  }
  if (task.scheduleType === "interval" && task.intervalMinutes) {
    return now + task.intervalMinutes * 60 * 1000;
  }
  if (task.scheduleType === "cron" && task.cronExpression) {
    // Simple 5-field cron calculation (minute hour dom month dow)
    return parseSimpleCronNextRun(task.cronExpression, now);
  }
  return now + 60 * 60 * 1000; // default 1 hour
}

function parseSimpleCronNextRun(cron: string, fromTimestamp: number): number {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return fromTimestamp + 60 * 60 * 1000;

  const [minStr, hourStr] = parts;
  const d = new Date(fromTimestamp);

  // If every N minutes (e.g. */5)
  if (minStr?.startsWith("*/")) {
    const step = parseInt(minStr.replace("*/", ""), 10) || 5;
    const currentMin = d.getMinutes();
    const nextMin = (Math.floor(currentMin / step) + 1) * step;
    d.setMinutes(nextMin, 0, 0);
    return d.getTime();
  }

  // If specific hour and minute (e.g. "0 9 * * *")
  const targetHour = hourStr !== "*" ? parseInt(hourStr ?? "9", 10) : d.getHours();
  const targetMin = minStr !== "*" ? parseInt(minStr ?? "0", 10) : 0;

  d.setHours(targetHour, targetMin, 0, 0);
  if (d.getTime() <= fromTimestamp) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

export function formatScheduleLabel(task: ScheduledTask): string {
  if (task.scheduleType === "timer") {
    const sec = task.durationSeconds ?? 60;
    if (sec < 60) return `In ${sec}s`;
    const min = Math.round(sec / 60);
    if (min < 60) return `In ${min}m`;
    const hrs = Math.round(min / 60);
    return `In ${hrs}h`;
  }
  if (task.scheduleType === "interval") {
    const min = task.intervalMinutes ?? 60;
    if (min < 60) return `Every ${min}m`;
    const hrs = min / 60;
    if (hrs === 24) return "Daily";
    return `Every ${hrs}h`;
  }
  if (task.scheduleType === "cron") {
    return `Cron: ${task.cronExpression || "* * * * *"}`;
  }
  return "Scheduled";
}

export function formatTimeUntil(timestamp: number): string {
  const diff = timestamp - Date.now();
  if (diff <= 0) return "Due now";
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `in ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}
