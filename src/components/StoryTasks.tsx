import { type FormEvent, useId, useState } from "react";
import { storyProgress } from "../domain/hierarchy";
import { formatItemKey } from "../domain/keys";
import type { Status, WorkItem } from "../domain/types";
import { STATUSES, STATUS_LABELS } from "../domain/workflow";
import { PriorityBadge, TypeBadge } from "./Badges";
import { inputClass } from "./Modal";
import { Progress } from "./Progress";

interface StoryTasksProps {
  story: WorkItem;
  projectKey: string;
  /** All items in the project; the tasks are picked out here. */
  items: WorkItem[];
  onOpen(id: string): void;
  onAddTask(storyId: string, title: string): Promise<void>;
  /** Link an existing task or bug to this story. */
  onLinkTask(storyId: string, itemId: string): Promise<void>;
  onStatusChange(item: WorkItem, status: Status): Promise<void>;
}

/** The tasks inside a story: progress, a quick-add box and a list you can open or advance. */
export function StoryTasks({
  story,
  projectKey,
  items,
  onOpen,
  onAddTask,
  onLinkTask,
  onStatusChange,
}: StoryTasksProps) {
  const id = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkId, setLinkId] = useState("");
  // Tasks and bugs that do not belong to any story yet.
  const available = items
    .filter((i) => i.type !== "story" && !i.parentId)
    .sort((a, b) => a.number - b.number);
  const tasks = items.filter((i) => i.parentId === story.id).sort((a, b) => a.number - b.number);
  const progress = storyProgress(items, story.id);

  async function guarded(action: () => Promise<void>): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return setError("Enter a title for the task.");
    if (await guarded(() => onAddTask(story.id, title))) setTitle("");
  }

  async function handleLink(event: FormEvent) {
    event.preventDefault();
    if (!linkId) return setError("Choose an item to add.");
    if (await guarded(() => onLinkTask(story.id, linkId))) setLinkId("");
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-8 border-t border-line pt-6">
      <h3 id={`${id}-heading`} className="mb-3 text-lg">
        Tasks{tasks.length > 0 && ` (${tasks.length})`}
      </h3>

      <Progress progress={progress} label="Story progress" />

      <form onSubmit={(e) => void handleAdd(e)} className="mt-3">
        <label htmlFor={`${id}-new`} className="mb-1 block text-sm font-bold">
          Add a task
        </label>
        <div className="flex gap-2">
          <input
            id={`${id}-new`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy}
            className="shrink-0 rounded-md bg-brand-red px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            Add task
          </button>
        </div>
      </form>

      {available.length > 0 && (
        <form onSubmit={(e) => void handleLink(e)} className="mt-4">
          <label htmlFor={`${id}-link`} className="mb-1 block text-sm font-bold">
            Add an existing item
          </label>
          <div className="flex gap-2">
            <select
              id={`${id}-link`}
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              className={inputClass}
            >
              <option value="">Choose a task or bug…</option>
              {available.map((i) => (
                <option key={i.id} value={i.id}>
                  {formatItemKey(projectKey, i.number)} · {i.title}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={busy}
              className="shrink-0 rounded-md border border-brand-red px-3 py-2 text-sm font-bold text-brand-red transition hover:bg-brand-red hover:text-white disabled:opacity-60"
            >
              Add to story
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-brand-red">
          {error}
        </p>
      )}

      {tasks.length === 0 ? (
        <p className="mt-4 text-sm">No tasks yet. Add a new one, or link an existing item.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {tasks.map((task) => {
            const key = formatItemKey(projectKey, task.number);
            return (
              <li key={task.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface p-2">
                <span className="font-mono text-xs font-bold">{key}</span>
                <button
                  type="button"
                  onClick={() => onOpen(task.id)}
                  className={`min-w-0 flex-1 text-left text-sm font-bold hover:text-brand-red ${
                    task.status === "done" ? "text-brand-gray line-through" : "text-ink"
                  }`}
                >
                  {task.title}
                </button>
                <TypeBadge type={task.type} />
                <PriorityBadge priority={task.priority} />
                <select
                  aria-label={`Status of ${key}`}
                  value={task.status}
                  disabled={busy}
                  onChange={(e) => void guarded(() => onStatusChange(task, e.target.value as Status))}
                  className="rounded-md border border-line bg-white px-2 py-1 text-xs font-bold text-ink hover:border-brand-gray"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
