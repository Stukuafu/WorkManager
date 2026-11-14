import { useId } from "react";
import type { Project } from "../domain/types";

interface ProjectSwitcherProps {
  projects: Project[];
  activeId: string | null;
  onSelect(id: string): void;
  onNew(): void;
}

export function ProjectSwitcher({ projects, activeId, onSelect, onNew }: ProjectSwitcherProps) {
  const selectId = useId();
  return (
    <div className="flex items-center gap-2">
      {projects.length > 0 && (
        <>
          <label htmlFor={selectId} className="sr-only">
            Project
          </label>
          <select
            id={selectId}
            value={activeId ?? ""}
            onChange={(e) => onSelect(e.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm font-bold text-ink hover:border-brand-gray"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.key} · {p.name}
              </option>
            ))}
          </select>
        </>
      )}
      <button
        type="button"
        onClick={onNew}
        className="rounded-md bg-brand-red px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-red-dark"
      >
        + New project
      </button>
    </div>
  );
}
