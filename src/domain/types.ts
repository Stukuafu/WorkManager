export type Status = "todo" | "in_progress" | "in_review" | "done";
export type Priority = "low" | "medium" | "high" | "critical";
export type ItemType = "task" | "bug" | "story";

export interface Project {
  id: string;
  /** 2-5 uppercase letters, unique, e.g. "WM". */
  key: string;
  name: string;
  /** Counter for item keys. Never reused, even after an item is deleted. */
  nextNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  /** Item key is `${project.key}-${number}`. */
  number: number;
  title: string;
  description: string;
  type: ItemType;
  status: Status;
  priority: Priority;
  labels: string[];
  dueDate?: string;
  /** The story this item belongs to. Only tasks and bugs can have one. */
  parentId?: string;
  /** Position within a board column. */
  order: number;
  createdAt: string;
  updatedAt: string;
  /** Set when status becomes "done", cleared if the item is reopened. */
  completedAt?: string;
  /** Set while the item is archived. Archived items are hidden from the board and, by default, the list. */
  archivedAt?: string;
}

export interface StatusChange {
  id: string;
  itemId: string;
  from: Status | null;
  to: Status;
  at: string;
}

/** A free-text note on a work item. */
export interface Note {
  id: string;
  itemId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export const MAX_NOTE_LENGTH = 10_000;

/** The list view's search and filter choices. "all" means no restriction. */
/** How the list treats archived items. */
export type ArchiveMode = "hide" | "include" | "only";

export interface ItemFilters {
  query: string;
  status: Status | "all";
  priority: Priority | "all";
  type: ItemType | "all";
  label: string | "all";
  /** Only tasks of this story (by story id). */
  parent: string | "all";
  archived: ArchiveMode;
}

/** A named set of filters, saved per project. */
export interface SavedFilter {
  id: string;
  projectId: string;
  name: string;
  filters: ItemFilters;
  createdAt: string;
  updatedAt: string;
}

export const MAX_FILTER_NAME_LENGTH = 60;
export const MAX_SEARCH_LENGTH = 200;
export const MAX_SAVED_FILTERS_PER_PROJECT = 30;

export type NewProject = Pick<Project, "key" | "name">;

export type NewWorkItem = Pick<WorkItem, "title"> &
  Partial<
    Pick<WorkItem, "description" | "type" | "status" | "priority" | "labels" | "dueDate" | "parentId">
  >;

/** The changes the bulk toolbar can apply to many items at once. */
export type BulkPatch = Partial<Pick<WorkItem, "status" | "priority" | "parentId">>;

export type WorkItemPatch = Partial<
  Pick<
    WorkItem,
    "title" | "description" | "type" | "status" | "priority" | "labels" | "dueDate" | "parentId" | "order"
  >
>;
