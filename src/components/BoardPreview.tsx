import { formatItemKey } from "../domain/keys";
import type { WorkItem } from "../domain/types";
import { STATUSES, STATUS_LABELS } from "../domain/workflow";
import { PriorityBadge } from "./Badges";

const STATUS_TINT = {
  todo: "bg-tint-blue",
  in_progress: "bg-tint-yellow",
  in_review: "bg-tint-teal",
  done: "bg-tint-green",
} as const;

interface BoardPreviewProps {
  projectKey: string;
  items: WorkItem[];
  onOpen(item: WorkItem): void;
}

/** Read-only columns. Drag-and-drop arrives in milestone 4. */
export function BoardPreview({ projectKey, items, onOpen }: BoardPreviewProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATUSES.map((status) => {
        const column = items.filter((i) => i.status === status).sort((a, b) => a.order - b.order);
        return (
          <section key={status} aria-label={STATUS_LABELS[status]} className="rounded-card bg-white p-3 shadow-sm">
            <div
              className={`mb-3 flex items-center justify-between rounded-md px-3 py-1.5 text-sm font-bold text-ink ${STATUS_TINT[status]}`}
            >
              {STATUS_LABELS[status]}
              <span>{column.length}</span>
            </div>
            {column.length === 0 ? (
              <p className="px-1 text-sm">No items</p>
            ) : (
              <ul className="space-y-2">
                {column.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="w-full rounded-md border border-line bg-white p-3 text-left transition hover:border-brand-red hover:shadow-sm"
                    >
                      <span className="mb-1 block font-mono text-xs font-bold">
                        {formatItemKey(projectKey, item.number)}
                      </span>
                      <span className="mb-2 block text-sm font-bold text-ink">{item.title}</span>
                      <PriorityBadge priority={item.priority} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
