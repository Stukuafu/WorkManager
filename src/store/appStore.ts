import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { planMove } from "../domain/board";
import type {
  BulkPatch,
  ItemFilters,
  NewProject,
  NewWorkItem,
  Note,
  Project,
  SavedFilter,
  Status,
  StatusChange,
  WorkItem,
  WorkItemPatch,
} from "../domain/types";
import { parseStoredData } from "../storage/validate";
import { LocalStorageRepository } from "../storage/localStorageRepository";
import type { Repository, StoredData } from "../storage/repository";

const ACTIVE_PROJECT_KEY = "work-manager:active-project";

export interface AppState {
  loaded: boolean;
  projects: Project[];
  activeProjectId: string | null;
  /** Items of the active project. */
  items: WorkItem[];
  /** Every note on every item in the active project. */
  notes: Note[];
  /** Saved filters for the active project, by name. */
  savedFilters: SavedFilter[];
  /** Load persisted data. Call once on startup. */
  init(): Promise<void>;
  /** Create a project and make it active. Rejects with the repository's validation error. */
  createProject(input: NewProject): Promise<Project>;
  selectProject(id: string): Promise<void>;
  createItem(input: NewWorkItem): Promise<WorkItem>;
  updateItem(id: string, patch: WorkItemPatch): Promise<WorkItem>;
  deleteItem(id: string): Promise<void>;
  /** Everything as a plain object, for backup. */
  exportData(): Promise<StoredData>;
  /** Replace all data with a validated backup. Throws with a readable message if invalid. */
  importData(raw: unknown): Promise<void>;
  /** Apply one change to several items at once (all-or-nothing). */
  updateItems(ids: string[], patch: BulkPatch): Promise<void>;
  deleteItems(ids: string[]): Promise<void>;
  /** Archive or unarchive items. */
  setArchived(ids: string[], archived: boolean): Promise<void>;
  /** Save the filters under a name; an existing name (ignoring case) is replaced. */
  saveFilter(name: string, filters: ItemFilters): Promise<SavedFilter>;
  deleteSavedFilter(id: string): Promise<void>;
  /** Notes on an item, oldest first. */
  loadNotes(itemId: string): Promise<Note[]>;
  addNote(itemId: string, body: string): Promise<Note>;
  updateNote(id: string, body: string): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  /** Status history for an item, oldest first. */
  loadHistory(id: string): Promise<StatusChange[]>;
  /** Move an item to a column and position. Updates the UI immediately, then persists. */
  moveItem(id: string, status: Status, index: number): Promise<void>;
}

function readActiveId(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_PROJECT_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  } catch {
    // Non-essential convenience; ignore storage failures.
  }
}

export function createAppStore(repo: Repository) {
  return createStore<AppState>((set, get) => {
    /** Load items for a project, ignoring the result if the user has since switched away. */
    async function loadItems(projectId: string): Promise<void> {
      const [items, notes, savedFilters] = await Promise.all([
        repo.listItems(projectId),
        repo.listProjectNotes(projectId),
        repo.listSavedFilters(projectId),
      ]);
      if (get().activeProjectId === projectId) set({ items, notes, savedFilters });
    }

    function requireActiveProject(): string {
      const id = get().activeProjectId;
      if (!id) throw new Error("No active project");
      return id;
    }

    return {
      loaded: false,
      projects: [],
      activeProjectId: null,
      items: [],
      notes: [],
      savedFilters: [],

      async init() {
        const projects = await repo.listProjects();
        const saved = readActiveId();
        const activeProjectId =
          projects.find((p) => p.id === saved)?.id ?? projects[0]?.id ?? null;
        const items = activeProjectId ? await repo.listItems(activeProjectId) : [];
        const notes = activeProjectId ? await repo.listProjectNotes(activeProjectId) : [];
        const savedFilters = activeProjectId ? await repo.listSavedFilters(activeProjectId) : [];
        set({ projects, activeProjectId, items, notes, savedFilters, loaded: true });
      },

      async createProject(input) {
        const project = await repo.createProject(input);
        set({ projects: [...get().projects, project], activeProjectId: project.id, items: [], notes: [], savedFilters: [] });
        writeActiveId(project.id);
        return project;
      },

      async selectProject(id) {
        if (!get().projects.some((p) => p.id === id)) return;
        set({ activeProjectId: id, items: [], notes: [], savedFilters: [] });
        writeActiveId(id);
        await loadItems(id);
      },

      async createItem(input) {
        const projectId = requireActiveProject();
        const item = await repo.createItem(projectId, input);
        // The repository advanced the project's counter; refresh our copy.
        const project = await repo.getProject(projectId);
        set({
          items: [...get().items, item],
          projects: project
            ? get().projects.map((p) => (p.id === projectId ? project : p))
            : get().projects,
        });
        return item;
      },

      async updateItem(id, patch) {
        const updated = await repo.updateItem(id, patch);
        set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
        return updated;
      },

      async deleteItem(id) {
        const projectId = requireActiveProject();
        await repo.deleteItem(id);
        // Reload: deleting a story also unlinks its tasks.
        await loadItems(projectId);
      },

      async exportData() {
        return repo.exportData();
      },

      async importData(raw) {
        // Validate first so a bad file never touches existing data.
        const data = parseStoredData(raw);
        await repo.importData(data);
        await get().init();
      },

      async saveFilter(name, filters) {
        const projectId = requireActiveProject();
        const saved = await repo.saveFilter(projectId, name, filters);
        if (get().activeProjectId === projectId) set({ savedFilters: await repo.listSavedFilters(projectId) });
        return saved;
      },

      async deleteSavedFilter(id) {
        await repo.deleteSavedFilter(id);
        set({ savedFilters: get().savedFilters.filter((f) => f.id !== id) });
      },

      async loadNotes(itemId) {
        return repo.listNotes(itemId);
      },

      async addNote(itemId, body) {
        const note = await repo.addNote(itemId, body);
        set({ notes: [...get().notes, note] });
        return note;
      },

      async updateNote(id, body) {
        const note = await repo.updateNote(id, body);
        set({ notes: get().notes.map((n) => (n.id === id ? note : n)) });
        return note;
      },

      async deleteNote(id) {
        await repo.deleteNote(id);
        set({ notes: get().notes.filter((n) => n.id !== id) });
      },

      async loadHistory(id) {
        const changes = await repo.listStatusChanges(id);
        return [...changes].sort((a, b) => a.at.localeCompare(b.at));
      },

      async updateItems(ids, patch) {
        const projectId = requireActiveProject();
        await repo.updateItems(ids, patch);
        await loadItems(projectId);
      },

      async deleteItems(ids) {
        const projectId = requireActiveProject();
        await repo.deleteItems(ids);
        await loadItems(projectId);
      },

      async setArchived(ids, archived) {
        const projectId = requireActiveProject();
        await repo.setArchived(ids, archived);
        await loadItems(projectId);
      },

      async moveItem(id, status, index) {
        const projectId = requireActiveProject();
        const before = get().items;
        const changes = planMove(before, id, status, index);
        if (changes.length === 0) return;

        // Optimistic update so the board reacts instantly.
        const byId = new Map(changes.map((c) => [c.id, c]));
        set({
          items: before.map((i) => {
            const c = byId.get(i.id);
            return c ? { ...i, status: c.status, order: c.order } : i;
          }),
        });

        try {
          const changed = await repo.moveItem(id, status, index);
          const fresh = new Map(changed.map((i) => [i.id, i]));
          if (get().activeProjectId === projectId) {
            set({ items: get().items.map((i) => fresh.get(i.id) ?? i) });
          }
        } catch (error) {
          await loadItems(projectId); // roll back to what is actually stored
          throw error;
        }
      },
    };
  });
}

const appStore = createAppStore(new LocalStorageRepository());

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export const selectActiveProject = (s: AppState): Project | undefined =>
  s.projects.find((p) => p.id === s.activeProjectId);
