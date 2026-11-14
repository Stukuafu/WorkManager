import { useCallback, useEffect, useMemo, useState } from "react";
import { Balloon } from "./components/Balloon";
import { NewProjectDialog } from "./components/NewProjectDialog";
import { ThemeSelect } from "./components/ThemeSelect";
import { ProjectBanner } from "./components/ProjectBanner";
import { ProjectSwitcher } from "./components/ProjectSwitcher";
import { useShortcuts } from "./components/useShortcuts";
import { projectStats, todayString } from "./domain/stats";
import { Board } from "./components/Board";
import { DataFooter } from "./components/DataFooter";
import { ItemDialog } from "./components/ItemDialog";
import { ItemPanel } from "./components/ItemPanel";
import { ListView } from "./components/ListView";
import { storiesIn } from "./domain/hierarchy";
import { countNotes, indexNotes } from "./domain/notes";
import { formatItemKey } from "./domain/keys";
import type { Status, WorkItem } from "./domain/types";
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
  const updateItems = useAppStore((s) => s.updateItems);
  const deleteItems = useAppStore((s) => s.deleteItems);
  const setArchived = useAppStore((s) => s.setArchived);
  const loadHistory = useAppStore((s) => s.loadHistory);
  const loadNotes = useAppStore((s) => s.loadNotes);
  const addNote = useAppStore((s) => s.addNote);
  const updateNote = useAppStore((s) => s.updateNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const notes = useAppStore((s) => s.notes);
  const savedFilters = useAppStore((s) => s.savedFilters);
  const saveFilter = useAppStore((s) => s.saveFilter);
  const deleteSavedFilter = useAppStore((s) => s.deleteSavedFilter);
  const noteCounts = useMemo(() => countNotes(notes), [notes]);
  const noteText = useMemo(() => indexNotes(notes), [notes]);
  const exportData = useAppStore((s) => s.exportData);
  const importData = useAppStore((s) => s.importData);
  const [creating, setCreating] = useState(false);
  const [creatingItem, setCreatingItem] = useState(false);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const openItem = items.find((i) => i.id === openItemId);
  const changeStatus = useCallback(
    (item: WorkItem, status: Status) => updateItem(item.id, { status }).then(() => undefined),
    [updateItem],
  );
  const [view, setView] = useState<"list" | "board">("list");
  const [actionError, setActionError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const focusSearch = useCallback(() => {
    setView("list");
    // Wait for the list view to render before focusing its search box.
    requestAnimationFrame(() => document.getElementById("search-items")?.focus());
  }, []);
  const startNewItem = useCallback(() => setCreatingItem(true), []);
  useShortcuts({ onNewItem: startNewItem, onSearch: focusSearch }, !!activeProject);

  useEffect(() => {
    init().catch((e: unknown) =>
      setLoadError(e instanceof Error ? e.message : "Could not load data."),
    );
  }, [init]);

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <a
        href="#main"
        className="sr-only z-20 rounded-md bg-card px-3 py-2 font-bold text-emphasis focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <header className="border-t-4 border-brand-red bg-card shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <Balloon size={28} />
            <h1 className="text-2xl">Work Manager</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {loaded && (
              <ProjectSwitcher
                projects={projects}
                activeId={activeProjectId}
                onSelect={selectProject}
                onNew={() => setCreating(true)}
              />
            )}
            <ThemeSelect />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {loadError && (
          <p role="alert" className="font-bold text-emphasis">
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
            <ProjectBanner project={activeProject} stats={projectStats(items, todayString())} />

            <div className="mb-4 flex items-center justify-between gap-3">
              <div role="tablist" aria-label="View" className="flex gap-1 rounded-md bg-card p-1 shadow-sm">
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
              <p role="alert" className="mb-3 text-sm font-bold text-emphasis">
                {actionError}
              </p>
            )}

            {view === "list" ? (
              <ListView
                key={activeProject.id}
                projectKey={activeProject.key}
                items={items}
                noteCounts={noteCounts}
                noteText={noteText}
                savedFilters={savedFilters}
                onSaveFilter={async (name, filters) => {
                  await saveFilter(name, filters);
                }}
                onDeleteSavedFilter={deleteSavedFilter}
                onBulkUpdate={updateItems}
                onBulkArchive={setArchived}
                onBulkDelete={deleteItems}
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
                noteCounts={noteCounts}
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

      {loaded && <DataFooter onExport={exportData} onImport={importData} />}

      {creatingItem && activeProject && (
        <ItemDialog
          parentOptions={storiesIn(items).map((s) => ({
            id: s.id,
            label: `${formatItemKey(activeProject.key, s.number)} · ${s.title}`,
          }))}
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
          items={items}
          onOpenItem={setOpenItemId}
          onAddTask={async (storyId, title) => {
            await createItem({ title, type: "task", parentId: storyId });
          }}
          onLinkTask={async (storyId, itemId) => {
            await updateItem(itemId, { parentId: storyId });
          }}
          onArchive={(itemId, archived) => setArchived([itemId], archived)}
          onStatusChange={changeStatus}
          loadHistory={loadHistory}
          loadNotes={loadNotes}
          onAddNote={addNote}
          onUpdateNote={updateNote}
          onDeleteNote={deleteNote}
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
