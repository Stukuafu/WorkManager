import { collectLabels, DEFAULT_FILTERS } from "./filter";
import { storiesIn } from "./hierarchy";
import { MAX_FILTER_NAME_LENGTH, type ItemFilters, type WorkItem } from "./types";

/** Two filter sets are equal if they would show the same thing (search text is compared trimmed). */
export function equalFilters(a: ItemFilters, b: ItemFilters): boolean {
  return (
    a.query.trim() === b.query.trim() &&
    a.status === b.status &&
    a.priority === b.priority &&
    a.type === b.type &&
    a.label === b.label &&
    a.parent === b.parent
  );
}

/** Tidy filters for saving: trim the search text and fill in anything missing. */
export function normalizeFilters(filters: ItemFilters): ItemFilters {
  return { ...DEFAULT_FILTERS, ...filters, query: filters.query.trim() };
}

/**
 * Make saved filters safe to apply: a label or story that no longer exists
 * would otherwise hide everything with no way to see why, so it is dropped.
 */
export function sanitizeFilters(filters: ItemFilters, items: WorkItem[]): ItemFilters {
  const labels = collectLabels(items);
  const storyIds = storiesIn(items).map((s) => s.id);
  return {
    ...filters,
    label: filters.label === "all" || labels.includes(filters.label) ? filters.label : "all",
    parent: filters.parent === "all" || storyIds.includes(filters.parent) ? filters.parent : "all",
  };
}

/** Trimmed name, or an error message if it is unusable. */
export function checkFilterName(name: string): { name: string; error?: undefined } | { error: string; name?: undefined } {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Give these filters a name." };
  if (trimmed.length > MAX_FILTER_NAME_LENGTH) {
    return { error: `Names can be at most ${MAX_FILTER_NAME_LENGTH} characters.` };
  }
  return { name: trimmed };
}
