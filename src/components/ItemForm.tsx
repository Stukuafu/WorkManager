import { type FormEvent, useId, useState } from "react";
import { parseLabels } from "../domain/filter";
import type { ItemType, NewWorkItem, Priority, Status, WorkItem } from "../domain/types";
import {
  ITEM_TYPES,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  TYPE_LABELS,
} from "../domain/workflow";
import { inputClass } from "./Modal";

export interface ParentOption {
  id: string;
  label: string;
}

interface ItemFormProps {
  /** Present when editing an existing item. */
  item?: WorkItem;
  /** Stories this item could belong to. */
  parentOptions?: ParentOption[];
  onSubmit(values: NewWorkItem): Promise<void>;
  onDelete?(): Promise<void>;
  onCancel(): void;
  cancelLabel?: string;
}

/** Fields shared by the "new item" dialog and the item detail panel. */
export function ItemForm({
  item,
  parentOptions = [],
  onSubmit,
  onDelete,
  onCancel,
  cancelLabel = "Cancel",
}: ItemFormProps) {
  const id = useId();
  const [title, setTitle] = useState(item?.title ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [type, setType] = useState<ItemType>(item?.type ?? "task");
  const [priority, setPriority] = useState<Priority>(item?.priority ?? "medium");
  const [status, setStatus] = useState<Status>(item?.status ?? "todo");
  const [labels, setLabels] = useState(item?.labels.join(", ") ?? "");
  const [dueDate, setDueDate] = useState(item?.dueDate ?? "");
  const [parentId, setParentId] = useState(item?.parentId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function run(action: () => Promise<void>) {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await action();
      setSaving(false);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSaving(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter a title.");
    void run(() =>
      onSubmit({
        title,
        description,
        type,
        priority,
        status,
        labels: parseLabels(labels),
        dueDate: dueDate || undefined,
        // Stories cannot have a parent; an empty choice clears any existing link.
        parentId: type === "story" ? undefined : parentId || undefined,
      }),
    );
  }

  const field = "mb-4";
  const label = "mb-1 block text-sm font-bold";

  return (
    <form onSubmit={handleSubmit} onChange={() => setSaved(false)}>
        <div className={field}>
          <label htmlFor={`${id}-title-input`} className={label}>
            Title
          </label>
          <input
            id={`${id}-title-input`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className={field}>
          <label htmlFor={`${id}-desc`} className={label}>
            Description
          </label>
          <textarea
            id={`${id}-desc`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={inputClass}
          />
        </div>

        <div className={`${field} grid grid-cols-3 gap-3`}>
          <div>
            <label htmlFor={`${id}-type`} className={label}>
              Type
            </label>
            <select
              id={`${id}-type`}
              value={type}
              onChange={(e) => setType(e.target.value as ItemType)}
              className={inputClass}
            >
              {ITEM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-priority`} className={label}>
              Priority
            </label>
            <select
              id={`${id}-priority`}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className={inputClass}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${id}-status`} className={label}>
              Status
            </label>
            <select
              id={`${id}-status`}
              value={status}
              onChange={(e) => setStatus(e.target.value as Status)}
              className={inputClass}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {type !== "story" && parentOptions.length > 0 && (
          <div className={field}>
            <label htmlFor={`${id}-parent`} className={label}>
              Parent story
            </label>
            <select
              id={`${id}-parent`}
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className={inputClass}
            >
              <option value="">None</option>
              {parentOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className={`${field} grid grid-cols-2 gap-3`}>
          <div>
            <label htmlFor={`${id}-labels`} className={label}>
              Labels
            </label>
            <input
              id={`${id}-labels`}
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="ui, backend"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor={`${id}-due`} className={label}>
              Due date
            </label>
            <input
              id={`${id}-due`}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {saved && (
          <p role="status" className="mb-3 text-sm font-bold text-ink">
            ✓ Saved
          </p>
        )}

        {error && (
          <p role="alert" className="mb-3 text-sm font-bold text-emphasis">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-2">
          <div>
            {item &&
              onDelete &&
              (confirmingDelete ? (
                <span className="flex items-center gap-2 text-sm">
                  Delete this item?
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void run(onDelete)}
                    className="rounded-md bg-brand-red px-3 py-1.5 font-bold text-white hover:bg-brand-red-dark"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-md px-3 py-1.5 font-bold hover:bg-surface"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-md px-3 py-2 text-sm font-bold text-emphasis hover:bg-surface"
                >
                  Delete
                </button>
              ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-sm font-bold hover:bg-surface"
            >
              {cancelLabel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
            >
              {item ? "Save changes" : "Create item"}
            </button>
          </div>
        </div>
    </form>
  );
}
