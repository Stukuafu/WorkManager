import type { WorkItem } from "./types";

export interface ProjectStats {
  total: number;
  open: number;
  done: number;
  overdue: number;
  /** Items that are archived. They are not counted in the other numbers. */
  archived: number;
}

/** Counts for the project banner. `today` is a YYYY-MM-DD string. */
export function projectStats(items: WorkItem[], today: string): ProjectStats {
  const current = items.filter((i) => !i.archivedAt);
  const done = current.filter((i) => i.status === "done").length;
  const overdue = current.filter((i) => i.status !== "done" && i.dueDate && i.dueDate < today).length;
  return {
    total: current.length,
    open: current.length - done,
    done,
    overdue,
    archived: items.length - current.length,
  };
}

/** Today's date in local time as YYYY-MM-DD. */
export function todayString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
