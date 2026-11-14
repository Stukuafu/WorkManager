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

export const SCHEMA_VERSION = 5;

export interface StoredData {
  version: number;
  projects: Project[];
  items: WorkItem[];
  statusChanges: StatusChange[];
  notes: Note[];
  savedFilters: SavedFilter[];
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
   * Apply the same change to several items. All-or-nothing: if any item cannot take it,
   * nothing changes and the error says why. Returns the updated items.
   */
  updateItems(ids: string[], patch: BulkPatch): Promise<WorkItem[]>;
  /** Delete several items (tasks of deleted stories are kept, unlinked). */
  deleteItems(ids: string[]): Promise<void>;
  /** Archive or unarchive items. Unarchived items return to the bottom of their column. Returns the items that changed. */
  setArchived(ids: string[], archived: boolean): Promise<WorkItem[]>;
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
  /** Every note on every item in a project, oldest first. */
  listProjectNotes(projectId: string): Promise<Note[]>;

  /** Saved filters for a project, by name. */
  listSavedFilters(projectId: string): Promise<SavedFilter[]>;
  /** Save filters under a name. A name already used in the project (ignoring case) is replaced. */
  saveFilter(projectId: string, name: string, filters: ItemFilters): Promise<SavedFilter>;
  deleteSavedFilter(id: string): Promise<void>;

  exportData(): Promise<StoredData>;
  importData(data: unknown): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryError";
  }
}
