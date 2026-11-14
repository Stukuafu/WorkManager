import { planMove } from "../domain/board";
import { isValidProjectKey, normalizeProjectKey } from "../domain/keys";
import type {
  NewProject,
  NewWorkItem,
  Project,
  Status,
  StatusChange,
  WorkItem,
  WorkItemPatch,
} from "../domain/types";
import { ITEM_TYPES, PRIORITIES, STATUSES } from "../domain/workflow";
import {
  type Repository,
  RepositoryError,
  SCHEMA_VERSION,
  type StoredData,
} from "./repository";

const STORAGE_KEY = "work-manager:data";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function emptyData(): StoredData {
  return { version: SCHEMA_VERSION, projects: [], items: [], statusChanges: [] };
}

function now(): string {
  return new Date().toISOString();
}

function newId(): string {
  return crypto.randomUUID();
}

/** Validate and normalise unknown input (stored or imported) into StoredData. */
export function parseStoredData(raw: unknown): StoredData {
  if (typeof raw !== "object" || raw === null) {
    throw new RepositoryError("Data is not an object");
  }
  const d = raw as Partial<StoredData>;
  if (typeof d.version !== "number" || d.version > SCHEMA_VERSION) {
    throw new RepositoryError(`Unsupported data version: ${String(d.version)}`);
  }
  if (!Array.isArray(d.projects) || !Array.isArray(d.items) || !Array.isArray(d.statusChanges)) {
    throw new RepositoryError("Data is missing projects, items or statusChanges");
  }
  // Future migrations from older versions go here.
  return {
    version: SCHEMA_VERSION,
    projects: d.projects,
    items: d.items,
    statusChanges: d.statusChanges,
  };
}

export class LocalStorageRepository implements Repository {
  private readonly storage: StorageLike;

  constructor(storage: StorageLike = window.localStorage) {
    this.storage = storage;
  }

  private load(): StoredData {
    const text = this.storage.getItem(STORAGE_KEY);
    if (!text) return emptyData();
    try {
      return parseStoredData(JSON.parse(text));
    } catch (error) {
      if (error instanceof RepositoryError) throw error;
      throw new RepositoryError("Stored data is corrupted");
    }
  }

  private save(data: StoredData): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async listProjects(): Promise<Project[]> {
    return this.load().projects;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.load().projects.find((p) => p.id === id);
  }

  async createProject(input: NewProject): Promise<Project> {
    const data = this.load();
    const key = normalizeProjectKey(input.key);
    const name = input.name.trim();
    if (!isValidProjectKey(key)) {
      throw new RepositoryError("Project key must be 2-5 letters (A-Z)");
    }
    if (!name) throw new RepositoryError("Project name is required");
    if (data.projects.some((p) => p.key === key)) {
      throw new RepositoryError(`Project key ${key} is already in use`);
    }
    const timestamp = now();
    const project: Project = {
      id: newId(),
      key,
      name,
      nextNumber: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    data.projects.push(project);
    this.save(data);
    return project;
  }

  async listItems(projectId: string): Promise<WorkItem[]> {
    return this.load()
      .items.filter((i) => i.projectId === projectId)
      .sort((a, b) => a.number - b.number);
  }

  async createItem(projectId: string, input: NewWorkItem): Promise<WorkItem> {
    const data = this.load();
    const project = data.projects.find((p) => p.id === projectId);
    if (!project) throw new RepositoryError("Project not found");
    const title = input.title.trim();
    if (!title) throw new RepositoryError("Title is required");

    const status = input.status ?? "todo";
    const priority = input.priority ?? "medium";
    const type = input.type ?? "task";
    if (!STATUSES.includes(status)) throw new RepositoryError(`Invalid status: ${status}`);
    if (!PRIORITIES.includes(priority)) throw new RepositoryError(`Invalid priority: ${priority}`);
    if (!ITEM_TYPES.includes(type)) throw new RepositoryError(`Invalid type: ${type}`);

    const timestamp = now();
    const inColumn = data.items.filter((i) => i.projectId === projectId && i.status === status);
    const item: WorkItem = {
      id: newId(),
      projectId,
      number: project.nextNumber,
      title,
      description: input.description ?? "",
      type,
      status,
      priority,
      labels: input.labels ?? [],
      dueDate: input.dueDate,
      order: inColumn.length === 0 ? 0 : Math.max(...inColumn.map((i) => i.order)) + 1,
      createdAt: timestamp,
      updatedAt: timestamp,
      completedAt: status === "done" ? timestamp : undefined,
    };

    // The counter only ever moves forward, so keys are never reused.
    project.nextNumber += 1;
    project.updatedAt = timestamp;
    data.items.push(item);
    data.statusChanges.push({ id: newId(), itemId: item.id, from: null, to: status, at: timestamp });
    this.save(data);
    return item;
  }

  async updateItem(id: string, patch: WorkItemPatch): Promise<WorkItem> {
    const data = this.load();
    const item = data.items.find((i) => i.id === id);
    if (!item) throw new RepositoryError("Item not found");

    if (patch.title !== undefined && !patch.title.trim()) {
      throw new RepositoryError("Title is required");
    }
    if (patch.status !== undefined && !STATUSES.includes(patch.status)) {
      throw new RepositoryError(`Invalid status: ${patch.status}`);
    }
    if (patch.priority !== undefined && !PRIORITIES.includes(patch.priority)) {
      throw new RepositoryError(`Invalid priority: ${patch.priority}`);
    }
    if (patch.type !== undefined && !ITEM_TYPES.includes(patch.type)) {
      throw new RepositoryError(`Invalid type: ${patch.type}`);
    }

    const timestamp = now();
    const previousStatus = item.status;
    Object.assign(item, patch, {
      title: patch.title !== undefined ? patch.title.trim() : item.title,
      updatedAt: timestamp,
    });

    if (item.status !== previousStatus) {
      data.statusChanges.push({
        id: newId(),
        itemId: item.id,
        from: previousStatus,
        to: item.status,
        at: timestamp,
      });
      item.completedAt = item.status === "done" ? timestamp : undefined;
      if (patch.order === undefined) {
        // Land at the bottom of the new column.
        const others = data.items.filter(
          (i) => i.projectId === item.projectId && i.status === item.status && i.id !== item.id,
        );
        item.order = others.length === 0 ? 0 : Math.max(...others.map((i) => i.order)) + 1;
      }
    }

    this.save(data);
    return item;
  }

  async deleteItem(id: string): Promise<void> {
    const data = this.load();
    data.items = data.items.filter((i) => i.id !== id);
    data.statusChanges = data.statusChanges.filter((c) => c.itemId !== id);
    this.save(data);
  }

  async moveItem(id: string, toStatus: Status, toIndex: number): Promise<WorkItem[]> {
    const data = this.load();
    const item = data.items.find((i) => i.id === id);
    if (!item) throw new RepositoryError("Item not found");
    if (!STATUSES.includes(toStatus)) throw new RepositoryError(`Invalid status: ${toStatus}`);

    const projectItems = data.items.filter((i) => i.projectId === item.projectId);
    const changes = planMove(projectItems, id, toStatus, toIndex);
    if (changes.length === 0) return [];

    const timestamp = now();
    const changed: WorkItem[] = [];
    for (const change of changes) {
      const target = data.items.find((i) => i.id === change.id);
      if (!target) continue;
      const previousStatus = target.status;
      target.order = change.order;
      target.status = change.status;
      if (target.id === id) {
        target.updatedAt = timestamp;
        if (previousStatus !== change.status) {
          data.statusChanges.push({
            id: newId(),
            itemId: id,
            from: previousStatus,
            to: change.status,
            at: timestamp,
          });
          target.completedAt = change.status === "done" ? timestamp : undefined;
        }
      }
      changed.push(target);
    }
    this.save(data);
    return changed;
  }

  async listStatusChanges(itemId: string): Promise<StatusChange[]> {
    return this.load().statusChanges.filter((c) => c.itemId === itemId);
  }

  async exportData(): Promise<StoredData> {
    return this.load();
  }

  async importData(raw: unknown): Promise<void> {
    this.save(parseStoredData(raw));
  }
}
