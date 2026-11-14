import type { WorkItem } from "./types";
import { ITEM_TYPES, PRIORITIES, STATUSES } from "./workflow";

export type SortField = "key" | "title" | "type" | "priority" | "status" | "due";
export type SortDirection = "asc" | "desc";

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

/** Newest first, as the list has always been. */
export const DEFAULT_SORT: SortState = { field: "key", direction: "desc" };

/** Direction used the first time a column is clicked: the most useful end first. */
export const FIRST_DIRECTION: Record<SortField, SortDirection> = {
  key: "desc", // newest first
  title: "asc", // A to Z
  type: "asc", // task, bug, story
  priority: "desc", // critical first
  status: "asc", // workflow order, To Do first
  due: "asc", // soonest first
};

/** Clicking the active column flips it; clicking another column starts at its natural direction. */
export function nextSort(current: SortState, field: SortField): SortState {
  if (current.field === field) {
    return { field, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { field, direction: FIRST_DIRECTION[field] };
}

function compare(a: WorkItem, b: WorkItem, field: SortField): number {
  switch (field) {
    case "key":
      return a.number - b.number;
    case "title":
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    case "type":
      return ITEM_TYPES.indexOf(a.type) - ITEM_TYPES.indexOf(b.type);
    case "priority":
      return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
    case "status":
      return STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status);
    case "due":
      return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
  }
}

/**
 * Sorted copy of the items. Ties fall back to newest first so the order is stable.
 * Items with no due date always sort last, whichever way the due column is sorted.
 */
export function sortItems(items: WorkItem[], sort: SortState): WorkItem[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sort.field === "due") {
      if (!a.dueDate && b.dueDate) return 1;
      if (a.dueDate && !b.dueDate) return -1;
    }
    return sign * compare(a, b, sort.field) || b.number - a.number;
  });
}
