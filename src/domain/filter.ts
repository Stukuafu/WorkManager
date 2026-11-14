import type { ItemType, Priority, Status, WorkItem } from "./types";
import { formatItemKey } from "./keys";

export interface ItemFilters {
  query: string;
  status: Status | "all";
  priority: Priority | "all";
  type: ItemType | "all";
  label: string | "all";
  /** Only tasks of this story (by story id). */
  parent: string | "all";
}

export const DEFAULT_FILTERS: ItemFilters = {
  query: "",
  status: "all",
  priority: "all",
  type: "all",
  label: "all",
  parent: "all",
};

export function hasActiveFilters(filters: ItemFilters): boolean {
  return (
    filters.query.trim() !== "" ||
    filters.status !== "all" ||
    filters.priority !== "all" ||
    filters.type !== "all" ||
    filters.label !== "all" ||
    filters.parent !== "all"
  );
}

/** Filter items. Search matches key, title, description and labels (case-insensitive). */
export function filterItems(items: WorkItem[], filters: ItemFilters, projectKey: string): WorkItem[] {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.label !== "all" && !item.labels.includes(filters.label)) return false;
    if (filters.parent !== "all" && item.parentId !== filters.parent) return false;
    if (query) {
      const haystack = [
        formatItemKey(projectKey, item.number),
        item.title,
        item.description,
        ...item.labels,
      ]
        .join("\n")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

/** All distinct labels used by the items, sorted alphabetically. */
export function collectLabels(items: WorkItem[]): string[] {
  return [...new Set(items.flatMap((i) => i.labels))].sort((a, b) => a.localeCompare(b));
}

/** Parse a comma-separated label string into trimmed, de-duplicated labels. */
export function parseLabels(text: string): string[] {
  return [...new Set(text.split(",").map((l) => l.trim()).filter(Boolean))];
}
