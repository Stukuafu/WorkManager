import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { isValidProjectKey, normalizeProjectKey, suggestProjectKey } from "../domain/keys";

interface NewProjectDialogProps {
  onSubmit(input: { key: string; name: string }): Promise<void>;
  onCancel(): void;
}

export function NewProjectDialog({ onSubmit, onCancel }: NewProjectDialogProps) {
  const nameId = useId();
  const keyId = useId();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyEdited, setKeyEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  function handleNameChange(value: string) {
    setName(value);
    if (!keyEdited) setKey(suggestProjectKey(value));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const normalizedKey = normalizeProjectKey(key);
    if (!name.trim()) return setError("Enter a project name.");
    if (!isValidProjectKey(normalizedKey)) return setError("Key must be 2-5 letters (A-Z).");
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ key: normalizedKey, name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the project.");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-line px-3 py-2 text-ink placeholder:text-brand-gray/60 focus:border-brand-red";

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onCancel()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${nameId}-title`}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-card bg-white p-6 shadow-xl"
      >
        <h2 id={`${nameId}-title`} className="mb-4 text-xl">
          New project
        </h2>

        <label htmlFor={nameId} className="mb-1 block text-sm font-bold">
          Name
        </label>
        <input
          id={nameId}
          ref={nameRef}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Work Manager"
          className={`${inputClass} mb-4`}
        />

        <label htmlFor={keyId} className="mb-1 block text-sm font-bold">
          Key
        </label>
        <input
          id={keyId}
          value={key}
          onChange={(e) => {
            setKeyEdited(true);
            setKey(e.target.value.toUpperCase());
          }}
          maxLength={5}
          placeholder="WM"
          aria-describedby={`${keyId}-hint`}
          className={`${inputClass} font-mono uppercase`}
        />
        <p id={`${keyId}-hint`} className="mt-1 text-xs">
          2-5 letters. Items will be numbered {key || "KEY"}-1, {key || "KEY"}-2, and so on.
        </p>

        {error && (
          <p role="alert" className="mt-3 text-sm font-bold text-brand-red">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-bold hover:bg-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-dark disabled:opacity-60"
          >
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
