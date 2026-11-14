import type { ItemType, Priority, Status } from "./types";

/** Fixed workflow. Any status may move to any other. */
export const STATUSES: readonly Status[] = ["todo", "in_progress", "in_review", "done"];
export const PRIORITIES: readonly Priority[] = ["low", "medium", "high", "critical"];
export const ITEM_TYPES: readonly ItemType[] = ["task", "bug", "story"];

export const STATUS_LABELS: Record<Status, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const TYPE_LABELS: Record<ItemType, string> = {
  task: "Task",
  bug: "Bug",
  story: "Story",
};
