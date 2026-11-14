import { type FormEvent, useId, useState } from "react";
import { inputClass, Modal } from "./Modal";
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

  return (
    <Modal title="New project" titleId={`${nameId}-title`} onClose={onCancel}>
      <form onSubmit={handleSubmit}>
        <label htmlFor={nameId} className="mb-1 block text-sm font-bold">
          Name
        </label>
        <input
          id={nameId}
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
          <p role="alert" className="mt-3 text-sm font-bold text-emphasis">
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
    </Modal>
  );
}
