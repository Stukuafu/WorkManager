import type { Project } from "../domain/types";
import type { ProjectStats } from "../domain/stats";

/**
 * Project header styled as a Ricoh "Imagination Balloon": a red rounded
 * square with a small tab at the bottom-right and light-weight white type.
 */
export function ProjectBanner({ project, stats }: { project: Project; stats: ProjectStats }) {
  return (
    <div className="relative mb-8 rounded-[1.25rem] bg-brand-red px-6 py-5 text-white">
      <span
        aria-hidden="true"
        className="absolute -bottom-3 right-8 h-6 w-6 rounded-md bg-brand-red"
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-white px-2 py-1 font-mono text-sm font-bold text-brand-red">
            {project.key}
          </span>
          <h2 className="text-3xl font-light text-white">{project.name}</h2>
        </div>
        <dl className="flex gap-6 text-sm">
          <div>
            <dt className="opacity-90">Open</dt>
            <dd className="text-2xl font-light">{stats.open}</dd>
          </div>
          <div>
            <dt className="opacity-90">Done</dt>
            <dd className="text-2xl font-light">{stats.done}</dd>
          </div>
          <div>
            <dt className="opacity-90">Overdue</dt>
            <dd className="text-2xl font-light">{stats.overdue}</dd>
          </div>
          {stats.archived > 0 && (
            <div>
              <dt className="opacity-90">Archived</dt>
              <dd className="text-2xl font-light">{stats.archived}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}
