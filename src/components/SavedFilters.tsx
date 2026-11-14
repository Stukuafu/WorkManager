import { type FormEvent, useId, useState } from "react";
import { equalFilters } from "../domain/savedFilters";
import type { ItemFilters, SavedFilter } from "../domain/types";
import { inputClass } from "./Modal";

interface SavedFiltersProps {
  saved: SavedFilter[];
  current: ItemFilters;
  /** Whether the current filters differ from "show everything". */
  active: boolean;
  onApply(filters: ItemFilters): void;
  onSave(name: string): Promise<void>;
  onDelete(id: string): Promise<void>;
}

const small = "rounded-md px-2 py-1.5 text-sm font-bold hover:bg-card";

/** Pick, save and delete named sets of list filters. */
export function SavedFilters({ saved, current, active, onApply, onSave, onDelete }: SavedFiltersProps) {
  const id = useId();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const matching = saved.find((f) => equalFilters(f.filters, current));
  const replacing = saved.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());

  async function run(action: () => Promise<void>): Promise<boolean> {
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

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (await run(() => onSave(name))) {
      setNaming(false);
      setName("");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {saved.length > 0 && (
        <select
          aria-label="Saved filters"
          value={matching?.id ?? ""}
          onChange={(e) => {
            const chosen = saved.find((f) => f.id === e.target.value);
            if (chosen) onApply(chosen.filters);
            setConfirmingDelete(false);
          }}
          className="rounded-md border border-line bg-card px-2 py-1.5 text-sm text-ink hover:border-brand-gray"
        >
          <option value="" disabled>
            Saved filters…
          </option>
          {saved.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      )}

      {matching &&
        (confirmingDelete ? (
          <span className="flex items-center gap-1 text-sm">
            Delete “{matching.name}”?
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => onDelete(matching.id)).then(() => setConfirmingDelete(false))}
              className="rounded-md bg-brand-red px-2 py-1 font-bold text-white hover:bg-brand-red-dark"
            >
              Yes, delete
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className={small}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmingDelete(true)} className={`${small} text-emphasis`}>
            Delete saved filter
          </button>
        ))}

      {active && !matching && !naming && (
        <button type="button" onClick={() => setNaming(true)} className={`${small} text-emphasis`}>
          Save filters
        </button>
      )}

      {naming && (
        <form onSubmit={(e) => void handleSave(e)} className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-name`} className="sr-only">
            Name for these filters
          </label>
          <input
            id={`${id}-name`}
            value={name}
            autoFocus
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setNaming(false);
              }
            }}
            placeholder="Name, e.g. My open bugs"
            className={`${inputClass} !w-52 !py-1.5 text-sm`}
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand-red px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
          >
            {replacing ? "Replace" : "Save"}
          </button>
          <button type="button" onClick={() => { setNaming(false); setError(null); }} className={small}>
            Cancel
          </button>
          {replacing && <span className="text-xs">Replaces the saved filter with this name.</span>}
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm font-bold text-emphasis">
          {error}
        </p>
      )}
    </div>
  );
}
