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
  /** Position within a board column. */
  order: number;
  createdAt: string;
  updatedAt: string;
  /** Set when status becomes "done", cleared if the item is reopened. */
  completedAt?: string;
}

export interface StatusChange {
  id: string;
  itemId: string;
  from: Status | null;
  to: Status;
  at: string;
}

export type NewProject = Pick<Project, "key" | "name">;

export type NewWorkItem = Pick<WorkItem, "title"> &
  Partial<
    Pick<WorkItem, "description" | "type" | "status" | "priority" | "labels" | "dueDate">
  >;

export type WorkItemPatch = Partial<
  Pick<
    WorkItem,
    "title" | "description" | "type" | "status" | "priority" | "labels" | "dueDate" | "order"
  >
>;
