import { useEffect, useId, useState } from "react";
import { formatItemKey } from "../domain/keys";
import { cycleTime, formatDateTime } from "../domain/time";
import { storiesIn } from "../domain/hierarchy";
import type { NewWorkItem, Note, Status, StatusChange, WorkItem } from "../domain/types";
import { STATUS_LABELS } from "../domain/workflow";
import { Drawer } from "./Drawer";
import { ItemForm } from "./ItemForm";
import { NotesSection } from "./NotesSection";
import { StoryTasks } from "./StoryTasks";

interface ItemPanelProps {
  projectKey: string;
  item: WorkItem;
  /** All items in the project, for parent/child lookups. */
  items: WorkItem[];
  onOpenItem(id: string): void;
  onAddTask(storyId: string, title: string): Promise<void>;
  onLinkTask(storyId: string, itemId: string): Promise<void>;
  onArchive(itemId: string, archived: boolean): Promise<void>;
  onStatusChange(item: WorkItem, status: Status): Promise<void>;
  loadHistory(id: string): Promise<StatusChange[]>;
  loadNotes(itemId: string): Promise<Note[]>;
  onAddNote(itemId: string, body: string): Promise<Note>;
  onUpdateNote(id: string, body: string): Promise<Note>;
  onDeleteNote(id: string): Promise<void>;
  onSave(values: NewWorkItem): Promise<void>;
  onDelete(): Promise<void>;
  onClose(): void;
}

/** Side panel to edit an item and see how it moved through the workflow. */
export function ItemPanel({
  projectKey,
  item,
  items,
  onOpenItem,
  onAddTask,
  onLinkTask,
  onArchive,
  onStatusChange,
  loadHistory,
  loadNotes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onSave,
  onDelete,
  onClose,
}: ItemPanelProps) {
  const id = useId();
  const key = formatItemKey(projectKey, item.number);
  const [history, setHistory] = useState<StatusChange[]>([]);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  // Reload whenever the item changes, since saving can change its status.
  useEffect(() => {
    let cancelled = false;
    loadHistory(item.id)
      .then((changes) => !cancelled && setHistory(changes))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [loadHistory, item.id, item.updatedAt]);

  const parent = item.parentId ? items.find((i) => i.id === item.parentId) : undefined;
  const parentOptions = storiesIn(items, item.id, item.parentId).map((s) => ({
    id: s.id,
    label: `${formatItemKey(projectKey, s.number)} · ${s.title}${s.archivedAt ? " (archived)" : ""}`,
  }));

  async function setArchived(archived: boolean) {
    setArchiveError(null);
    setArchiving(true);
    try {
      await onArchive(item.id, archived);
    } catch (e) {
      setArchiveError(e instanceof Error ? e.message : "Could not change the archive state.");
    } finally {
      setArchiving(false);
    }
  }

  const cycle = cycleTime(item.createdAt, item.completedAt);

  return (
    <Drawer title={`${key} · Edit item`} titleId={`${id}-title`} onClose={onClose}>
      {item.archivedAt && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface p-3 text-sm">
          <span className="text-ink">
            <strong>Archived</strong> on {formatDateTime(item.archivedAt)}. It is hidden from the board and list.
          </span>
          <button
            type="button"
            disabled={archiving}
            onClick={() => void setArchived(false)}
            className="rounded-md bg-brand-red px-3 py-1.5 font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            Unarchive
          </button>
        </div>
      )}

      {parent && (
        <p className="mb-4 text-sm">
          Part of{" "}
          <button
            type="button"
            onClick={() => onOpenItem(parent.id)}
            className="font-bold text-ink underline decoration-brand-red underline-offset-2 hover:text-emphasis"
          >
            {formatItemKey(projectKey, parent.number)} · {parent.title}
          </button>
        </p>
      )}

      <ItemForm
        key={item.id}
        item={item}
        parentOptions={parentOptions}
        onSubmit={onSave}
        onDelete={onDelete}
        onCancel={onClose}
        cancelLabel="Close"
      />

      {item.type === "story" && (
        <StoryTasks
          key={`tasks-${item.id}`}
          story={item}
          projectKey={projectKey}
          items={items}
          onOpen={onOpenItem}
          onAddTask={onAddTask}
          onLinkTask={onLinkTask}
          onStatusChange={onStatusChange}
        />
      )}

      <NotesSection
        key={`notes-${item.id}`}
        itemId={item.id}
        loadNotes={loadNotes}
        onAdd={onAddNote}
        onUpdate={onUpdateNote}
        onDelete={onDeleteNote}
      />

      <section aria-labelledby={`${id}-details`} className="mt-8 border-t border-line pt-6">
        <h3 id={`${id}-details`} className="mb-3 text-lg">
          Details
        </h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="font-bold">Created</dt>
          <dd>{formatDateTime(item.createdAt)}</dd>
          <dt className="font-bold">Updated</dt>
          <dd>{formatDateTime(item.updatedAt)}</dd>
          {item.completedAt && (
            <>
              <dt className="font-bold">Completed</dt>
              <dd>{formatDateTime(item.completedAt)}</dd>
            </>
          )}
          {item.archivedAt && (
            <>
              <dt className="font-bold">Archived</dt>
              <dd>{formatDateTime(item.archivedAt)}</dd>
            </>
          )}
          {cycle && (
            <>
              <dt className="font-bold">Time to complete</dt>
              <dd>{cycle}</dd>
            </>
          )}
        </dl>
        {!item.archivedAt && (
          <div className="mt-4">
            <button
              type="button"
              disabled={archiving}
              onClick={() => void setArchived(true)}
              className="rounded-md border border-line px-3 py-1.5 text-sm font-bold text-ink hover:border-brand-gray disabled:opacity-60"
            >
              Archive item
            </button>
            <p className="mt-1 text-xs">Hides it from the board and list. You can bring it back any time.</p>
          </div>
        )}
        {archiveError && (
          <p role="alert" className="mt-2 text-sm font-bold text-emphasis">
            {archiveError}
          </p>
        )}
      </section>

      <section aria-labelledby={`${id}-history`} className="mt-6">
        <h3 id={`${id}-history`} className="mb-3 text-lg">
          History
        </h3>
        {history.length === 0 ? (
          <p className="text-sm">No history yet.</p>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-line pl-4">
            {[...history].reverse().map((change) => (
              <li key={change.id} className="text-sm">
                <span
                  aria-hidden="true"
                  className={`absolute -left-[7px] mt-1 h-3 w-3 rounded-full ${
                    change.to === "done" ? "bg-accent-green" : "bg-brand-red"
                  }`}
                />
                <p className="font-bold text-ink">
                  {change.from === null
                    ? `Created in ${STATUS_LABELS[change.to]}`
                    : `${STATUS_LABELS[change.from]} → ${STATUS_LABELS[change.to]}`}
                </p>
                <p className="text-xs">{formatDateTime(change.at)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </Drawer>
  );
}
