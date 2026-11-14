import type { WorkItem } from "./types";

export interface ProjectStats {
  total: number;
  open: number;
  done: number;
  overdue: number;
}

/** Counts for the project banner. `today` is a YYYY-MM-DD string. */
export function projectStats(items: WorkItem[], today: string): ProjectStats {
  const done = items.filter((i) => i.status === "done").length;
  const overdue = items.filter((i) => i.status !== "done" && i.dueDate && i.dueDate < today).length;
  return { total: items.length, open: items.length - done, done, overdue };
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
