import { type ChangeEvent, useId, useRef, useState } from "react";
import { downloadJson } from "../lib/download";
import { RepositoryError, type StoredData } from "../storage/repository";
import { parseStoredData } from "../storage/validate";
import { Modal } from "./Modal";

interface DataFooterProps {
  onExport(): Promise<StoredData>;
  onImport(raw: unknown): Promise<void>;
}

const button = "rounded-md px-3 py-1.5 text-sm font-bold hover:bg-card";

export function DataFooter({ onExport, onImport }: DataFooterProps) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ raw: unknown; data: StoredData } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setError(null);
    try {
      const data = await onExport();
      downloadJson(`work-manager-backup-${new Date().toISOString().slice(0, 10)}.json`, data);
      setMessage("Backup downloaded.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not export data.");
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      const raw: unknown = JSON.parse(await file.text());
      setPending({ raw, data: parseStoredData(raw) });
    } catch (e) {
      setError(
        e instanceof RepositoryError
          ? `This is not a valid backup: ${e.message}`
          : "This file is not valid JSON.",
      );
    }
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      await onImport(pending.raw);
      setMessage("Backup restored.");
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not import the backup.");
      setPending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <footer className="mx-auto w-full max-w-6xl px-6 pb-10 pt-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p>
          Shortcuts: <kbd className="rounded border border-line bg-card px-1.5 font-mono">C</kbd> new
          item · <kbd className="rounded border border-line bg-card px-1.5 font-mono">/</kbd> search
        </p>
        <div className="flex items-center gap-1">
          <p role="status" className="mr-2">
            {message}
          </p>
          <button type="button" onClick={() => void handleExport()} className={button}>
            Export backup
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={button}>
            Import backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleFile(e)}
            className="sr-only"
            tabIndex={-1}
            aria-label="Choose backup file"
          />
        </div>
      </div>
      <p className="mt-2 text-xs">
        Your data is stored in this browser only. Export a backup to keep it safe or move it to
        another device.
      </p>
      {error && (
        <p role="alert" className="mt-2 font-bold text-emphasis">
          {error}
        </p>
      )}

      {pending && (
        <Modal title="Replace all data?" titleId={`${id}-title`} onClose={() => setPending(null)}>
          <p className="mb-2 text-sm">
            This backup contains <strong>{pending.data.projects.length}</strong>{" "}
            {pending.data.projects.length === 1 ? "project" : "projects"} and{" "}
            <strong>{pending.data.items.length}</strong>{" "}
            {pending.data.items.length === 1 ? "item" : "items"}.
          </p>
          <p className="mb-6 text-sm">
            Importing replaces everything currently stored in this browser. Export a backup first if
            you want to keep it.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-md px-4 py-2 text-sm font-bold hover:bg-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void confirmImport()}
              className="rounded-md bg-brand-red px-4 py-2 text-sm font-bold text-white hover:bg-brand-red-dark disabled:opacity-60"
            >
              Replace data
            </button>
          </div>
        </Modal>
      )}
    </footer>
  );
}
