import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { planMove } from "../domain/board";
import type {
  NewProject,
  NewWorkItem,
  Project,
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
      const items = await repo.listItems(projectId);
      if (get().activeProjectId === projectId) set({ items });
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

      async init() {
        const projects = await repo.listProjects();
        const saved = readActiveId();
        const activeProjectId =
          projects.find((p) => p.id === saved)?.id ?? projects[0]?.id ?? null;
        const items = activeProjectId ? await repo.listItems(activeProjectId) : [];
        set({ projects, activeProjectId, items, loaded: true });
      },

      async createProject(input) {
        const project = await repo.createProject(input);
        set({ projects: [...get().projects, project], activeProjectId: project.id, items: [] });
        writeActiveId(project.id);
        return project;
      },

      async selectProject(id) {
        if (!get().projects.some((p) => p.id === id)) return;
        set({ activeProjectId: id, items: [] });
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
        await repo.deleteItem(id);
        set({ items: get().items.filter((i) => i.id !== id) });
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

      async loadHistory(id) {
        const changes = await repo.listStatusChanges(id);
        return [...changes].sort((a, b) => a.at.localeCompare(b.at));
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
