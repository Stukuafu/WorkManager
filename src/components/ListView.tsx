import { useMemo, useState } from "react";
import {
  collectLabels,
  DEFAULT_FILTERS,
  filterItems,
  hasActiveFilters,
  type ItemFilters,
  matchesOnlyInNotes,
} from "../domain/filter";
import { storiesIn, storyProgress } from "../domain/hierarchy";
import { formatItemKey } from "../domain/keys";
import { sanitizeFilters } from "../domain/savedFilters";
import { DEFAULT_SORT, nextSort, type SortField, type SortState, sortItems } from "../domain/sort";
import type { SavedFilter, Status, WorkItem } from "../domain/types";
import {
  ITEM_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "../domain/workflow";
import { LabelChip, PriorityBadge, TypeBadge } from "./Badges";
import { NoteCount } from "./NoteCount";
import { SavedFilters } from "./SavedFilters";
import { Progress } from "./Progress";

interface ListViewProps {
  projectKey: string;
  items: WorkItem[];
  noteCounts: Record<string, number>;
  /** Each item's note text, lower-cased, for searching. */
  noteText: Record<string, string>;
  savedFilters: SavedFilter[];
  onSaveFilter(name: string, filters: ItemFilters): Promise<void>;
  onDeleteSavedFilter(id: string): Promise<void>;
  onOpen(item: WorkItem): void;
  onStatusChange(item: WorkItem, status: Status): void;
  onCreate(): void;
}

const COLUMNS: { field: SortField; label: string }[] = [
  { field: "key", label: "Key" },
  { field: "title", label: "Title" },
  { field: "type", label: "Type" },
  { field: "priority", label: "Priority" },
  { field: "status", label: "Status" },
  { field: "due", label: "Due" },
];

const filterSelect =
  "rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink hover:border-brand-gray";

export function ListView({
  projectKey,
  items,
  noteCounts,
  noteText,
  savedFilters,
  onSaveFilter,
  onDeleteSavedFilter,
  onOpen,
  onStatusChange,
  onCreate,
}: ListViewProps) {
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const labels = useMemo(() => collectLabels(items), [items]);
  const stories = useMemo(() => storiesIn(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = useMemo(
    () => sortItems(filterItems(items, filters, projectKey, noteText), sort),
    [items, filters, projectKey, noteText, sort],
  );

  function set<K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  if (items.length === 0) {
    return (
      <div className="rounded-card bg-white p-10 text-center shadow-sm">
        <h2 className="mb-2 text-xl">No work items yet</h2>
        <p className="mb-4 text-sm">Add your first item to start tracking work.</p>
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark"
        >
          New item
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          id="search-items"
          type="search"
          aria-label="Search items"
          placeholder="Search key, title, description, label, notes"
          value={filters.query}
          onChange={(e) => set("query", e.target.value)}
          className="min-w-64 flex-1 rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink focus:border-brand-red"
        />
        <select
          aria-label="Filter by status"
          value={filters.status}
          onChange={(e) => set("status", e.target.value as ItemFilters["status"])}
          className={filterSelect}
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={filters.priority}
          onChange={(e) => set("priority", e.target.value as ItemFilters["priority"])}
          className={filterSelect}
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => set("type", e.target.value as ItemFilters["type"])}
          className={filterSelect}
        >
          <option value="all">All types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        {labels.length > 0 && (
          <select
            aria-label="Filter by label"
            value={filters.label}
            onChange={(e) => set("label", e.target.value)}
            className={filterSelect}
          >
            <option value="all">All labels</option>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
        {stories.length > 0 && (
          <select
            aria-label="Filter by story"
            value={filters.parent}
            onChange={(e) => set("parent", e.target.value)}
            className={filterSelect}
          >
            <option value="all">All stories</option>
            {stories.map((st) => (
              <option key={st.id} value={st.id}>
                {formatItemKey(projectKey, st.number)} · {st.title}
              </option>
            ))}
          </select>
        )}
        <SavedFilters
          saved={savedFilters}
          current={filters}
          active={hasActiveFilters(filters)}
          onApply={(f) => setFilters(sanitizeFilters(f, items))}
          onSave={(name) => onSaveFilter(name, filters)}
          onDelete={onDeleteSavedFilter}
        />
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => setFilters(DEFAULT_FILTERS)}
            className="rounded-md px-2 py-1.5 text-sm font-bold text-brand-red hover:bg-white"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="mb-2 text-xs" aria-live="polite">
        Showing {visible.length} of {items.length} items
      </p>

      {visible.length === 0 ? (
        <div className="rounded-card bg-white p-8 text-center text-sm shadow-sm">
          No items match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide">
              <tr>
                {COLUMNS.map(({ field, label }) => {
                  const active = sort.field === field;
                  return (
                    <th
                      key={field}
                      scope="col"
                      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : undefined}
                      className="px-4 py-3"
                    >
                      <button
                        type="button"
                        onClick={() => setSort((current) => nextSort(current, field))}
                        className={`inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-brand-red ${
                          active ? "font-bold text-ink" : ""
                        }`}
                      >
                        {label}
                        <span aria-hidden="true" className="w-3 text-brand-red">
                          {active ? (sort.direction === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const key = formatItemKey(projectKey, item.number);
                return (
                  <tr key={item.id} className="border-b border-line last:border-0 hover:bg-surface">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold">{key}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className="text-left font-bold text-ink hover:text-brand-red"
                      >
                        {item.title}
                      </button>
                      {item.parentId && byId.get(item.parentId) && (
                        <span
                          className="ml-2 inline-block rounded-md bg-tint-pink px-1.5 py-0.5 align-middle text-xs font-bold text-ink"
                          title={`Part of ${byId.get(item.parentId)?.title}`}
                        >
                          <span className="sr-only">Part of </span>
                          {formatItemKey(projectKey, byId.get(item.parentId)!.number)}
                        </span>
                      )}
                      {item.type === "story" && (
                        <span className="ml-2 align-middle">
                          <Progress compact progress={storyProgress(items, item.id)} label={`Progress of ${key}`} />
                        </span>
                      )}
                      <span className="ml-2 align-middle">
                        <NoteCount count={noteCounts[item.id]} />
                      </span>
                      {matchesOnlyInNotes(item, filters.query, projectKey, noteText) && (
                        <span className="ml-2 inline-block rounded-md border border-line px-1.5 py-0.5 align-middle text-xs italic">
                          matches in notes
                        </span>
                      )}
                      {item.labels.length > 0 && (
                        <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                          {item.labels.map((l) => (
                            <LabelChip key={l} label={l} />
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <TypeBadge type={item.type} />
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={item.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        aria-label={`Status of ${key}`}
                        value={item.status}
                        onChange={(e) => onStatusChange(item, e.target.value as Status)}
                        className="rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-ink hover:border-brand-gray"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">{item.dueDate ?? "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
