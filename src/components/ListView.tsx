import { useEffect, useMemo, useRef, useState } from "react";
import {
  byArchiveMode,
  collectLabels,
  DEFAULT_FILTERS,
  filterItems,
  hasActiveFilters,
  type ItemFilters,
  matchesOnlyInNotes,
} from "../domain/filter";
import { allStories, storiesIn, storyProgress } from "../domain/hierarchy";
import { formatItemKey } from "../domain/keys";
import { sanitizeFilters } from "../domain/savedFilters";
import { DEFAULT_SORT, nextSort, type SortField, type SortState, sortItems } from "../domain/sort";
import type { BulkPatch, SavedFilter, Status, WorkItem } from "../domain/types";
import {
  ITEM_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "../domain/workflow";
import { LabelChip, PriorityBadge, TypeBadge } from "./Badges";
import { BulkBar } from "./BulkBar";
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
  onBulkUpdate(ids: string[], patch: BulkPatch): Promise<void>;
  onBulkArchive(ids: string[], archived: boolean): Promise<void>;
  onBulkDelete(ids: string[]): Promise<void>;
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
  "rounded-md border border-line bg-card px-2 py-1.5 text-sm text-ink hover:border-brand-gray";

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
  onBulkUpdate,
  onBulkArchive,
  onBulkDelete,
  onCreate,
}: ListViewProps) {
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const labels = useMemo(() => collectLabels(items), [items]);
  const storyOptions = useMemo(() => allStories(items), [items]);
  const movableStories = useMemo(() => storiesIn(items), [items]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const visible = useMemo(
    () => sortItems(filterItems(items, filters, projectKey, noteText), sort),
    [items, filters, projectKey, noteText, sort],
  );
  // Selection only ever applies to rows you can see.
  const chosen = visible.filter((i) => selected.has(i.id));
  const allChosen = visible.length > 0 && chosen.length === visible.length;
  const baseCount = byArchiveMode(items, filters.archived).length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = chosen.length > 0 && !allChosen;
  });

  /** Changing what is shown also clears the selection, so a bulk action never touches hidden rows. */
  function applyFilters(next: ItemFilters | ((f: ItemFilters) => ItemFilters)) {
    setFilters(next);
    setSelected(new Set());
    setNotice(null);
    setBulkError(null);
  }

  function set<K extends keyof ItemFilters>(key: K, value: ItemFilters[K]) {
    applyFilters((f) => ({ ...f, [key]: value }));
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setNotice(null);
  }

  function toggleAll() {
    setSelected(allChosen ? new Set() : new Set(visible.map((i) => i.id)));
    setNotice(null);
  }

  async function runBulk(action: () => Promise<void>, message: string, clearAfter: boolean) {
    setBulkError(null);
    setNotice(null);
    setBusy(true);
    try {
      await action();
      setNotice(message);
      if (clearAfter) setSelected(new Set());
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const countText = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

  if (items.length === 0) {
    return (
      <div className="rounded-card bg-card p-10 text-center shadow-sm">
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
          className="min-w-64 flex-1 rounded-md border border-line bg-card px-3 py-1.5 text-sm text-ink focus:border-brand-red"
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
        {storyOptions.length > 0 && (
          <select
            aria-label="Filter by story"
            value={filters.parent}
            onChange={(e) => set("parent", e.target.value)}
            className={filterSelect}
          >
            <option value="all">All stories</option>
            {storyOptions.map((st) => (
              <option key={st.id} value={st.id}>
                {formatItemKey(projectKey, st.number)} · {st.title}
                {st.archivedAt ? " (archived)" : ""}
              </option>
            ))}
          </select>
        )}
        <select
          aria-label="Archived items"
          value={filters.archived}
          onChange={(e) => set("archived", e.target.value as ItemFilters["archived"])}
          className={filterSelect}
        >
          <option value="hide">Hide archived</option>
          <option value="include">Include archived</option>
          <option value="only">Only archived</option>
        </select>
        <SavedFilters
          saved={savedFilters}
          current={filters}
          active={hasActiveFilters(filters)}
          onApply={(f) => applyFilters(sanitizeFilters(f, items))}
          onSave={(name) => onSaveFilter(name, filters)}
          onDelete={onDeleteSavedFilter}
        />
        {hasActiveFilters(filters) && (
          <button
            type="button"
            onClick={() => applyFilters(DEFAULT_FILTERS)}
            className="rounded-md px-2 py-1.5 text-sm font-bold text-emphasis hover:bg-card"
          >
            Clear filters
          </button>
        )}
      </div>

      <p className="mb-2 text-xs" aria-live="polite">
        Showing {visible.length} of {baseCount} items
      </p>

      {chosen.length > 0 && (
        <BulkBar
          selected={chosen}
          projectKey={projectKey}
          stories={movableStories}
          busy={busy}
          onUpdate={(patch, description) => {
            const ids = chosen.map((i) => i.id);
            void runBulk(() => onBulkUpdate(ids, patch), `${countText(ids.length)} ${description}.`, false);
          }}
          onArchive={(archived) => {
            const ids = chosen.filter((i) => (archived ? !i.archivedAt : i.archivedAt)).map((i) => i.id);
            void runBulk(
              () => onBulkArchive(ids, archived),
              `${archived ? "Archived" : "Unarchived"} ${countText(ids.length)}.`,
              true,
            );
          }}
          onDelete={() => {
            const ids = chosen.map((i) => i.id);
            void runBulk(() => onBulkDelete(ids), `Deleted ${countText(ids.length)}.`, true);
          }}
          onClear={() => setSelected(new Set())}
        />
      )}

      {notice && (
        <p role="status" className="mb-3 text-sm font-bold text-ink">
          {notice}
        </p>
      )}
      {bulkError && (
        <p role="alert" className="mb-3 text-sm font-bold text-emphasis">
          {bulkError}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-card bg-card p-8 text-center text-sm shadow-sm">
          No items match your filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide">
              <tr>
                <th scope="col" className="w-10 py-3 pl-4">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    aria-label="Select all shown items"
                    checked={allChosen}
                    onChange={toggleAll}
                    className="h-4 w-4 accent-brand-red"
                  />
                </th>
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
                        className={`inline-flex items-center gap-1 rounded uppercase tracking-wide hover:text-emphasis ${
                          active ? "font-bold text-ink" : ""
                        }`}
                      >
                        {label}
                        <span aria-hidden="true" className="w-3 text-emphasis">
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
                  <tr
                    key={item.id}
                    className={`border-b border-line last:border-0 hover:bg-surface ${
                      selected.has(item.id) ? "bg-surface" : ""
                    }`}
                  >
                    <td className="w-10 py-3 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${key}`}
                        checked={selected.has(item.id)}
                        onChange={() => toggle(item.id)}
                        className="h-4 w-4 accent-brand-red"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-bold">{key}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onOpen(item)}
                        className={`text-left font-bold hover:text-emphasis ${
                          // Archived rows are toned down with colour, not opacity, so text stays readable.
                          item.archivedAt ? "text-brand-gray" : "text-ink"
                        }`}
                      >
                        {item.title}
                      </button>
                      {item.archivedAt && (
                        <span className="ml-2 inline-block rounded-md border border-line px-1.5 py-0.5 align-middle text-xs italic">
                          Archived
                        </span>
                      )}
                      {item.parentId && byId.get(item.parentId) && (
                        <span
                          className="ml-2 inline-block rounded-md bg-tint-pink px-1.5 py-0.5 align-middle text-xs font-bold text-on-color"
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
                        className="rounded-md border border-line bg-card px-2 py-1 text-xs font-bold text-ink hover:border-brand-gray"
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
