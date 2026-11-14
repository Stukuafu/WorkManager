import type { ItemFilters, WorkItem } from "./types";
import { formatItemKey } from "./keys";

export type { ItemFilters } from "./types";

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

function fieldsMatch(item: WorkItem, query: string, projectKey: string): boolean {
  const haystack = [formatItemKey(projectKey, item.number), item.title, item.description, ...item.labels]
    .join("\n")
    .toLowerCase();
  return haystack.includes(query);
}

/**
 * True when the search text appears in an item's notes but not in its own fields,
 * so the list can say why the item matched.
 */
export function matchesOnlyInNotes(
  item: WorkItem,
  queryText: string,
  projectKey: string,
  noteText: Record<string, string>,
): boolean {
  const query = queryText.trim().toLowerCase();
  if (!query) return false;
  return !fieldsMatch(item, query, projectKey) && (noteText[item.id] ?? "").includes(query);
}

/**
 * Filter items. Search matches key, title, description, labels and note text
 * (case-insensitive). `noteText` is each item's lower-cased notes joined together.
 */
export function filterItems(
  items: WorkItem[],
  filters: ItemFilters,
  projectKey: string,
  noteText: Record<string, string> = {},
): WorkItem[] {
  const query = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.priority !== "all" && item.priority !== filters.priority) return false;
    if (filters.type !== "all" && item.type !== filters.type) return false;
    if (filters.label !== "all" && !item.labels.includes(filters.label)) return false;
    if (filters.parent !== "all" && item.parentId !== filters.parent) return false;
    if (query && !fieldsMatch(item, query, projectKey) && !(noteText[item.id] ?? "").includes(query)) {
      return false;
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
