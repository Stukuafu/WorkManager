import type {
  NewProject,
  NewWorkItem,
  Note,
  Project,
  Status,
  StatusChange,
  WorkItem,
  WorkItemPatch,
} from "../domain/types";

export const SCHEMA_VERSION = 2;

export interface StoredData {
  version: number;
  projects: Project[];
  items: WorkItem[];
  statusChanges: StatusChange[];
  notes: Note[];
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
  /**
   * Move an item to a column and position (0 = top). Renumbers the affected
   * columns and logs the status change. Returns every item that changed.
   */
  moveItem(id: string, toStatus: Status, toIndex: number): Promise<WorkItem[]>;
  listStatusChanges(itemId: string): Promise<StatusChange[]>;

  /** Notes on an item, oldest first. */
  listNotes(itemId: string): Promise<Note[]>;
  addNote(itemId: string, body: string): Promise<Note>;
  updateNote(id: string, body: string): Promise<Note>;
  deleteNote(id: string): Promise<void>;
  /** Number of notes per item id, for every item in a project (items with none are omitted). */
  noteCounts(projectId: string): Promise<Record<string, number>>;

  exportData(): Promise<StoredData>;
  importData(data: unknown): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}
