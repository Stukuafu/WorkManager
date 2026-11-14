import { useMemo, useState } from "react";
import {
  collectLabels,
  DEFAULT_FILTERS,
  filterItems,
  hasActiveFilters,
  type ItemFilters,
} from "../domain/filter";
import { formatItemKey } from "../domain/keys";
import type { Status, WorkItem } from "../domain/types";
import {
  ITEM_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "../domain/workflow";
import { LabelChip, PriorityBadge, TypeBadge } from "./Badges";

interface ListViewProps {
  projectKey: string;
  items: WorkItem[];
  onOpen(item: WorkItem): void;
  onStatusChange(item: WorkItem, status: Status): void;
  onCreate(): void;
}

const filterSelect =
  "rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink hover:border-brand-gray";

export function ListView({ projectKey, items, onOpen, onStatusChange, onCreate }: ListViewProps) {
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const labels = useMemo(() => collectLabels(items), [items]);
  const visible = useMemo(
    () => filterItems(items, filters, projectKey).sort((a, b) => b.number - a.number),
    [items, filters, projectKey],
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
          type="search"
          aria-label="Search items"
          placeholder="Search key, title, description, label"
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
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
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
