import { useEffect, useState } from "react";
import { Balloon } from "./components/Balloon";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { Board } from "./components/Board";
import { ItemDialog } from "./components/ItemDialog";
import { ItemPanel } from "./components/ItemPanel";
import { ListView } from "./components/ListView";
import type { Status } from "./domain/types";
import { selectActiveProject, useAppStore } from "./store/appStore";

export default function App() {
  const loaded = useAppStore((s) => s.loaded);
  const projects = useAppStore((s) => s.projects);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const activeProject = useAppStore(selectActiveProject);
  const init = useAppStore((s) => s.init);
  const createProject = useAppStore((s) => s.createProject);
  const items = useAppStore((s) => s.items);
  const selectProject = useAppStore((s) => s.selectProject);
  const createItem = useAppStore((s) => s.createItem);
  const updateItem = useAppStore((s) => s.updateItem);
  const deleteItem = useAppStore((s) => s.deleteItem);
  const moveItem = useAppStore((s) => s.moveItem);
  const loadHistory = useAppStore((s) => s.loadHistory);
  const [creating, setCreating] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const openItem = items.find((i) => i.id === openItemId);
  const [view, setView] = useState<"list" | "board">("list");
  const [actionError, setActionError] = useState<string | null>(null);
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
            <div className="mb-4 flex items-center justify-between gap-3">
              <div role="tablist" aria-label="View" className="flex gap-1 rounded-md bg-white p-1 shadow-sm">
                {(["list", "board"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    role="tab"
                    aria-selected={view === v}
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1.5 text-sm font-bold capitalize transition ${
                      view === v ? "bg-brand-red text-white" : "hover:bg-surface"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCreatingItem(true)}
                className="rounded-md bg-brand-red px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-red-dark"
              >
                + New item
              </button>
            </div>

            {actionError && (
              <p role="alert" className="mb-3 text-sm font-bold text-brand-red">
                {actionError}
              </p>
            )}

            {view === "list" ? (
              <ListView
                key={activeProject.id}
                projectKey={activeProject.key}
                items={items}
                onOpen={(item) => setOpenItemId(item.id)}
                onCreate={() => setCreatingItem(true)}
                onStatusChange={(item, status) => {
                  setActionError(null);
                  updateItem(item.id, { status }).catch((e: unknown) =>
                    setActionError(e instanceof Error ? e.message : "Could not update the item."),
                  );
                }}
              />
            ) : (
              <Board
                projectKey={activeProject.key}
                items={items}
                onOpen={(item) => setOpenItemId(item.id)}
                onMove={(id: string, status: Status, index: number) => {
                  setActionError(null);
                  moveItem(id, status, index).catch((e: unknown) =>
                    setActionError(e instanceof Error ? e.message : "Could not move the item."),
                  );
                }}
              />
            )}
          </>
        )}
      </main>

      {creatingItem && activeProject && (
        <ItemDialog
          onCancel={() => setCreatingItem(false)}
          onSubmit={async (values) => {
            await createItem(values);
            setCreatingItem(false);
          }}
        />
      )}

      {openItem && activeProject && (
        <ItemPanel
          projectKey={activeProject.key}
          item={openItem}
          loadHistory={loadHistory}
          onClose={() => setOpenItemId(null)}
          onSave={async (values) => {
            await updateItem(openItem.id, values);
          }}
          onDelete={async () => {
            await deleteItem(openItem.id);
            setOpenItemId(null);
          }}
        />
      )}

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
