import type {
  NewProject,
  NewWorkItem,
  Project,
  StatusChange,
  WorkItem,
  WorkItemPatch,
} from "../domain/types";

export const SCHEMA_VERSION = 1;

export interface StoredData {
  version: number;
  projects: Project[];
  items: WorkItem[];
  statusChanges: StatusChange[];
}

/**
 * Storage boundary. The UI only talks to this interface, so the
 * localStorage implementation can later be swapped for a backend.
 */
export interface Repository {
  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(input: NewProject): Promise<Project>;

  listItems(projectId: string): Promise<WorkItem[]>;
  createItem(projectId: string, input: NewWorkItem): Promise<WorkItem>;
  updateItem(id: string, patch: WorkItemPatch): Promise<WorkItem>;
  deleteItem(id: string): Promise<void>;
  listStatusChanges(itemId: string): Promise<StatusChange[]>;

  exportData(): Promise<StoredData>;
  importData(data: unknown): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}
