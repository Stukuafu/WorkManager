import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { NewProject, NewWorkItem, Project, WorkItem, WorkItemPatch } from "../domain/types";
import { LocalStorageRepository } from "../storage/localStorageRepository";
import type { Repository } from "../storage/repository";

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
    };
  });
}

const appStore = createAppStore(new LocalStorageRepository());

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export const selectActiveProject = (s: AppState): Project | undefined =>
  s.projects.find((p) => p.id === s.activeProjectId);
