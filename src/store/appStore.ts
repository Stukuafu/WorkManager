import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import type { NewProject, Project } from "../domain/types";
import { LocalStorageRepository } from "../storage/localStorageRepository";
import type { Repository } from "../storage/repository";

const ACTIVE_PROJECT_KEY = "work-manager:active-project";

export interface AppState {
  loaded: boolean;
  projects: Project[];
  activeProjectId: string | null;
  /** Load persisted data. Call once on startup. */
  init(): Promise<void>;
  /** Create a project and make it active. Rejects with the repository's validation error. */
  createProject(input: NewProject): Promise<Project>;
  selectProject(id: string): void;
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
  return createStore<AppState>((set, get) => ({
    loaded: false,
    projects: [],
    activeProjectId: null,

    async init() {
      const projects = await repo.listProjects();
      const saved = readActiveId();
      const activeProjectId =
        projects.find((p) => p.id === saved)?.id ?? projects[0]?.id ?? null;
      set({ projects, activeProjectId, loaded: true });
    },

    async createProject(input) {
      const project = await repo.createProject(input);
      set({ projects: [...get().projects, project], activeProjectId: project.id });
      writeActiveId(project.id);
      return project;
    },

    selectProject(id) {
      if (!get().projects.some((p) => p.id === id)) return;
      set({ activeProjectId: id });
      writeActiveId(id);
    },
  }));
}

const appStore = createAppStore(new LocalStorageRepository());

export function useAppStore<T>(selector: (state: AppState) => T): T {
  return useStore(appStore, selector);
}

export const selectActiveProject = (s: AppState): Project | undefined =>
  s.projects.find((p) => p.id === s.activeProjectId);
