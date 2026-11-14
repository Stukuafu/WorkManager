import { useState } from "react";
import { formatItemKey } from "../domain/keys";
import type { BulkPatch, Priority, Status, WorkItem } from "../domain/types";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "../domain/workflow";

interface BulkBarProps {
  selected: WorkItem[];
  projectKey: string;
  /** Stories the selection can be moved into. */
  stories: WorkItem[];
  busy: boolean;
  onUpdate(patch: BulkPatch, description: string): void;
  onArchive(archived: boolean): void;
  onDelete(): void;
  onClear(): void;
}

const select =
  "rounded-md border border-line bg-card px-2 py-1.5 text-sm font-bold text-ink hover:border-brand-gray disabled:opacity-60";
const action = "rounded-md px-2 py-1.5 text-sm font-bold hover:bg-surface disabled:opacity-60";

/** Toolbar shown above the list while rows are selected. */
export function BulkBar({ selected, projectKey, stories, busy, onUpdate, onArchive, onDelete, onClear }: BulkBarProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const count = selected.length;
  const noun = count === 1 ? "item" : "items";
  const anyActive = selected.some((i) => !i.archivedAt);
  const anyArchived = selected.some((i) => i.archivedAt);

  return (
    <section
      aria-label="Bulk actions"
      className="mb-3 flex flex-wrap items-center gap-2 rounded-card border border-brand-red bg-card p-3 shadow-sm"
    >
      <span className="mr-1 text-sm text-ink" aria-live="polite">
        <strong>{count}</strong> {noun} selected
      </span>

      <select
        aria-label="Set status for selected"
        value=""
        disabled={busy}
        onChange={(e) => {
          const status = e.target.value as Status;
          if (status) onUpdate({ status }, `moved to ${STATUS_LABELS[status]}`);
        }}
        className={select}
      >
        <option value="">Set status…</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>

      <select
        aria-label="Set priority for selected"
        value=""
        disabled={busy}
        onChange={(e) => {
          const priority = e.target.value as Priority;
          if (priority) onUpdate({ priority }, `set to ${PRIORITY_LABELS[priority]} priority`);
        }}
        className={select}
      >
        <option value="">Set priority…</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      {stories.length > 0 && (
        <select
          aria-label="Move selected to a story"
          value=""
          disabled={busy}
          onChange={(e) => {
            const value = e.target.value;
            if (!value) return;
            if (value === "__none") onUpdate({ parentId: undefined }, "removed from their story");
            else {
              const story = stories.find((s) => s.id === value);
              onUpdate({ parentId: value }, `moved into ${story ? formatItemKey(projectKey, story.number) : "the story"}`);
            }
          }}
          className={select}
        >
          <option value="">Move to story…</option>
          <option value="__none">No story</option>
          {stories.map((s) => (
            <option key={s.id} value={s.id}>
              {formatItemKey(projectKey, s.number)} · {s.title}
            </option>
          ))}
        </select>
      )}

      {anyActive && (
        <button type="button" disabled={busy} onClick={() => onArchive(true)} className={action}>
          Archive
        </button>
      )}
      {anyArchived && (
        <button type="button" disabled={busy} onClick={() => onArchive(false)} className={action}>
          Unarchive
        </button>
      )}

      {confirmingDelete ? (
        <span className="flex items-center gap-1 text-sm text-ink">
          Delete {count} {noun}?
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmingDelete(false);
              onDelete();
            }}
            className="rounded-md bg-brand-red px-2 py-1 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            Yes, delete
          </button>
          <button type="button" onClick={() => setConfirmingDelete(false)} className={action}>
            Keep
          </button>
        </span>
      ) : (
        <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className={`${action} text-emphasis`}>
          Delete
        </button>
      )}

      <button type="button" onClick={onClear} className={`${action} ml-auto`}>
        Clear selection
      </button>
    </section>
  );
}
