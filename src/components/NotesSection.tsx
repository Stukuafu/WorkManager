import { type KeyboardEvent, useCallback, useEffect, useId, useState } from "react";
import { formatDateTime } from "../domain/time";
import { MAX_NOTE_LENGTH, type Note } from "../domain/types";
import { inputClass } from "./Modal";

interface NotesSectionProps {
  itemId: string;
  loadNotes(itemId: string): Promise<Note[]>;
  onAdd(itemId: string, body: string): Promise<Note>;
  onUpdate(id: string, body: string): Promise<Note>;
  onDelete(id: string): Promise<void>;
}

const smallButton = "rounded-md px-2 py-1 text-xs font-bold hover:bg-surface";

/** Free-text notes on an item. Newest first; add, edit and delete in place. */
export function NotesSection({ itemId, loadNotes, onAdd, onUpdate, onDelete }: NotesSectionProps) {
  const id = useId();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const loaded = await loadNotes(itemId);
    setNotes([...loaded].reverse());
  }, [loadNotes, itemId]);

  useEffect(() => {
    let cancelled = false;
    loadNotes(itemId)
      .then((loaded) => {
        if (!cancelled) setNotes([...loaded].reverse());
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load notes.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [loadNotes, itemId]);

  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(null);
    setBusy(true);
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!draft.trim()) return setError("Write something in the note first.");
    if (await run(async () => void (await onAdd(itemId, draft)))) setDraft("");
  }

  async function saveEdit(noteId: string) {
    if (await run(async () => void (await onUpdate(noteId, editText)))) setEditingId(null);
  }

  /** Ctrl/Cmd+Enter submits from a textarea. */
  function submitOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>, submit: () => void) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-8 border-t border-line pt-6">
      <h3 id={`${id}-heading`} className="mb-3 text-lg">
        Notes{notes.length > 0 && ` (${notes.length})`}
      </h3>

      <label htmlFor={`${id}-new`} className="mb-1 block text-sm font-bold">
        Add a note
      </label>
      <textarea
        id={`${id}-new`}
        value={draft}
        rows={3}
        maxLength={MAX_NOTE_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => submitOnShortcut(e, () => void add())}
        placeholder="Decisions, blockers, links, progress…"
        className={inputClass}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs">Ctrl+Enter to add</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => void add()}
          className="rounded-md bg-brand-red px-3 py-1.5 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
        >
          Add note
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-brand-red">
          {error}
        </p>
      )}

      {loading ? (
        <p className="mt-4 text-sm">Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className="mt-4 text-sm">No notes yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border border-line bg-surface p-3">
              {editingId === note.id ? (
                <div>
                  <label htmlFor={`${id}-edit`} className="sr-only">
                    Edit note
                  </label>
                  <textarea
                    id={`${id}-edit`}
                    value={editText}
                    rows={4}
                    maxLength={MAX_NOTE_LENGTH}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => submitOnShortcut(e, () => void saveEdit(note.id))}
                    className={inputClass}
                  />
                  <div className="mt-2 flex justify-end gap-1">
                    <button type="button" onClick={() => setEditingId(null)} className={smallButton}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveEdit(note.id)}
                      className="rounded-md bg-brand-red px-2 py-1 text-xs font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
                    >
                      Save note
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm text-ink">{note.body}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-xs">
                      {formatDateTime(note.createdAt)}
                      {note.updatedAt !== note.createdAt && " · edited"}
                    </span>
                    {deletingId === note.id ? (
                      <span className="flex items-center gap-1 text-xs">
                        Delete this note?
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void run(() => onDelete(note.id)).then(() => setDeletingId(null))
                          }
                          className="rounded-md bg-brand-red px-2 py-1 font-bold text-white hover:bg-brand-red-dark"
                        >
                          Yes, delete
                        </button>
                        <button type="button" onClick={() => setDeletingId(null)} className={smallButton}>
                          Keep
                        </button>
                      </span>
                    ) : (
                      <span className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditText(note.body);
                            setDeletingId(null);
                          }}
                          className={smallButton}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingId(note.id)}
                          className={`${smallButton} text-brand-red`}
                        >
                          Delete
                        </button>
                      </span>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
