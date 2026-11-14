import { useEffect, useState } from "react";
import { Balloon } from "./components/Balloon";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { STATUSES, STATUS_LABELS } from "./domain/workflow";
import { selectActiveProject, useAppStore } from "./store/appStore";

const STATUS_TINT = {
  todo: "bg-tint-blue",
  in_progress: "bg-tint-yellow",
  in_review: "bg-tint-teal",
  done: "bg-tint-green",
} as const;

export default function App() {
  const loaded = useAppStore((s) => s.loaded);
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeProject = useAppStore(selectActiveProject);
  const init = useAppStore((s) => s.init);
  const createProject = useAppStore((s) => s.createProject);
  const selectProject = useAppStore((s) => s.selectProject);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    init().catch((e: unknown) =>
      setLoadError(e instanceof Error ? e.message : "Could not load data."),
    );
  }, [init]);

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-t-4 border-brand-red bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Balloon size={28} />
            <h1 className="text-2xl">Work Manager</h1>
          </div>
          {loaded && (
            <ProjectSwitcher
              projects={projects}
              activeId={activeProjectId}
              onSelect={selectProject}
              onNew={() => setCreating(true)}
            />
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {loadError && (
          <p role="alert" className="font-bold text-brand-red">
            {loadError}
          </p>
        )}

        {loaded && !activeProject && (
          <div className="mx-auto mt-12 max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <Balloon size={72} className="bg-tint-pink" />
            </div>
            <h2 className="mb-2 text-2xl">Create your first project</h2>
            <p className="mb-6 text-sm">
              A project groups your work items and gives them keys like WM-1.
            </p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="rounded-md bg-brand-red px-5 py-2.5 font-bold text-white transition hover:bg-brand-red-dark"
            >
              New project
            </button>
          </div>
        )}

        {activeProject && (
          <>
            <div className="mb-6 flex items-center gap-3">
              <span className="rounded-md bg-brand-red px-2 py-1 font-mono text-sm font-bold text-white">
                {activeProject.key}
              </span>
              <h2 className="text-xl text-ink">{activeProject.name}</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STATUSES.map((status) => (
                <section key={status} className="rounded-card bg-white p-4 shadow-sm">
                  <div
                    className={`mb-3 rounded-md px-3 py-1.5 text-sm font-bold text-ink ${STATUS_TINT[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </div>
                  <p className="text-sm">No items yet</p>
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      {creating && (
        <NewProjectDialog
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => {
            await createProject(input);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
