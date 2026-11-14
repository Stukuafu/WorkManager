import { parentError } from "../domain/hierarchy";
import { isValidProjectKey } from "../domain/keys";
import {
  type ItemFilters,
  MAX_FILTER_NAME_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_SAVED_FILTERS_PER_PROJECT,
  MAX_SEARCH_LENGTH,
  type Note,
  type Project,
  type SavedFilter,
  type StatusChange,
  type WorkItem,
} from "../domain/types";
import { ITEM_TYPES, PRIORITIES, STATUSES } from "../domain/workflow";
import { RepositoryError, SCHEMA_VERSION, type StoredData } from "./repository";

type Rec = Record<string, unknown>;

function fail(message: string): never {
  throw new RepositoryError(message);
}

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(r: Rec, field: string, where: string): string {
  const v = r[field];
  if (typeof v !== "string") fail(`${where}: "${field}" must be text`);
  return v;
}

function optStr(r: Rec, field: string, where: string): string | undefined {
  const v = r[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") fail(`${where}: "${field}" must be text`);
  return v;
}

function int(r: Rec, field: string, where: string, min: number): number {
  const v = r[field];
  if (typeof v !== "number" || !Number.isInteger(v) || v < min) {
    fail(`${where}: "${field}" must be a whole number of at least ${min}`);
  }
  return v;
}

function oneOf<T extends string>(r: Rec, field: string, allowed: readonly T[], where: string): T {
  const v = r[field];
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) {
    fail(`${where}: "${field}" must be one of ${allowed.join(", ")}`);
  }
  return v as T;
}

function list(data: Rec, field: string): unknown[] {
  const v = data[field];
  if (!Array.isArray(v)) fail(`Data is missing the "${field}" list`);
  return v;
}

/**
 * Validate unknown input (stored or imported) and return clean StoredData.
 * Throws RepositoryError with a readable message for anything malformed.
 * Unknown extra fields are dropped. Project counters are raised if they
 * are behind the highest item number, so keys can never be reused.
 */
export function parseStoredData(raw: unknown): StoredData {
  if (!isRec(raw)) fail("Data is not an object");
  if (typeof raw.version !== "number" || raw.version > SCHEMA_VERSION || raw.version < 1) {
    fail(`Unsupported data version: ${String(raw.version)}`);
  }
  // Older versions only lack newer optional data: v1 had no notes, v1-v2 had no parent links,
  // v1-v3 had no saved filters, v1-v4 had no archived items.
  // Migrating is just defaulting those, so nothing else needs converting.

  const projects: Project[] = list(raw, "projects").map((entry, i) => {
    const where = `Project ${i + 1}`;
    if (!isRec(entry)) fail(`${where} is not an object`);
    const key = str(entry, "key", where);
    if (!isValidProjectKey(key)) fail(`${where}: key "${key}" must be 2-5 capital letters`);
    return {
      id: str(entry, "id", where),
      key,
      name: str(entry, "name", where),
      nextNumber: int(entry, "nextNumber", where, 1),
      createdAt: str(entry, "createdAt", where),
      updatedAt: str(entry, "updatedAt", where),
    };
  });
  if (new Set(projects.map((p) => p.id)).size !== projects.length) fail("Duplicate project ids");
  if (new Set(projects.map((p) => p.key)).size !== projects.length) fail("Duplicate project keys");

  const projectIds = new Set(projects.map((p) => p.id));
  const seenNumbers = new Set<string>();
  const items: WorkItem[] = list(raw, "items").map((entry, i) => {
    const where = `Item ${i + 1}`;
    if (!isRec(entry)) fail(`${where} is not an object`);
    const projectId = str(entry, "projectId", where);
    if (!projectIds.has(projectId)) fail(`${where}: refers to an unknown project`);
    const number = int(entry, "number", where, 1);
    const numberKey = `${projectId}:${number}`;
    if (seenNumbers.has(numberKey)) fail(`${where}: duplicate item number ${number}`);
    seenNumbers.add(numberKey);
    const labels = entry.labels;
    if (!Array.isArray(labels) || labels.some((l) => typeof l !== "string")) {
      fail(`${where}: "labels" must be a list of text`);
    }
    if (typeof entry.order !== "number" || !Number.isFinite(entry.order)) {
      fail(`${where}: "order" must be a number`);
    }
    return {
      id: str(entry, "id", where),
      projectId,
      number,
      title: str(entry, "title", where),
      description: str(entry, "description", where),
      type: oneOf(entry, "type", ITEM_TYPES, where),
      status: oneOf(entry, "status", STATUSES, where),
      priority: oneOf(entry, "priority", PRIORITIES, where),
      labels: labels as string[],
      dueDate: optStr(entry, "dueDate", where),
      parentId: optStr(entry, "parentId", where),
      archivedAt: optStr(entry, "archivedAt", where),
      order: entry.order,
      createdAt: str(entry, "createdAt", where),
      updatedAt: str(entry, "updatedAt", where),
      completedAt: optStr(entry, "completedAt", where),
    };
  });
  if (new Set(items.map((i) => i.id)).size !== items.length) fail("Duplicate item ids");

  items.forEach((entry, i) => {
    const message = parentError(items, entry, entry.parentId);
    if (message) fail(`Item ${i + 1}: ${message}`);
  });

  // Never let a project counter fall behind its items.
  for (const project of projects) {
    const highest = Math.max(0, ...items.filter((i) => i.projectId === project.id).map((i) => i.number));
    if (project.nextNumber <= highest) project.nextNumber = highest + 1;
  }

  const itemIds = new Set(items.map((i) => i.id));
  const statusChanges: StatusChange[] = list(raw, "statusChanges")
    .map((entry, i) => {
      const where = `Status change ${i + 1}`;
      if (!isRec(entry)) fail(`${where} is not an object`);
      const from = entry.from === null ? null : oneOf(entry, "from", STATUSES, where);
      return {
        id: str(entry, "id", where),
        itemId: str(entry, "itemId", where),
        from,
        to: oneOf(entry, "to", STATUSES, where),
        at: str(entry, "at", where),
      };
    })
    .filter((c) => itemIds.has(c.itemId)); // drop history for items that no longer exist

  const notes: Note[] = (raw.version >= 2 ? list(raw, "notes") : [])
    .map((entry, i) => {
      const where = `Note ${i + 1}`;
      if (!isRec(entry)) fail(`${where} is not an object`);
      const body = str(entry, "body", where);
      if (!body.trim()) fail(`${where}: "body" must not be empty`);
      if (body.length > MAX_NOTE_LENGTH) fail(`${where}: "body" is too long`);
      return {
        id: str(entry, "id", where),
        itemId: str(entry, "itemId", where),
        body,
        createdAt: str(entry, "createdAt", where),
        updatedAt: str(entry, "updatedAt", where),
      };
    })
    .filter((n) => itemIds.has(n.itemId)); // drop notes for items that no longer exist
  if (new Set(notes.map((n) => n.id)).size !== notes.length) fail("Duplicate note ids");

  const savedFilters: SavedFilter[] = (raw.version >= 4 ? list(raw, "savedFilters") : []).map((entry, i) => {
    const where = `Saved filter ${i + 1}`;
    if (!isRec(entry)) fail(`${where} is not an object`);
    const projectId = str(entry, "projectId", where);
    if (!projectIds.has(projectId)) fail(`${where}: refers to an unknown project`);
    const name = str(entry, "name", where).trim();
    if (!name || name.length > MAX_FILTER_NAME_LENGTH) fail(`${where}: "name" must be 1-${MAX_FILTER_NAME_LENGTH} characters`);
    const f = entry.filters;
    if (!isRec(f)) fail(`${where}: "filters" must be an object`);
    const query = str(f, "query", `${where} filters`);
    if (query.length > MAX_SEARCH_LENGTH) fail(`${where}: search text is too long`);
    const filters: ItemFilters = {
      query,
      status: oneOf(f, "status", ["all", ...STATUSES], `${where} filters`),
      priority: oneOf(f, "priority", ["all", ...PRIORITIES], `${where} filters`),
      type: oneOf(f, "type", ["all", ...ITEM_TYPES], `${where} filters`),
      label: str(f, "label", `${where} filters`),
      parent: str(f, "parent", `${where} filters`),
      // Filters saved before archiving existed have no mode: they hid nothing special, i.e. "hide".
      archived: f.archived === undefined ? "hide" : oneOf(f, "archived", ["hide", "include", "only"], `${where} filters`),
    };
    return {
      id: str(entry, "id", where),
      projectId,
      name,
      filters,
      createdAt: str(entry, "createdAt", where),
      updatedAt: str(entry, "updatedAt", where),
    };
  });
  if (new Set(savedFilters.map((f) => f.id)).size !== savedFilters.length) fail("Duplicate saved filter ids");
  const nameKeys = savedFilters.map((f) => `${f.projectId}:${f.name.toLowerCase()}`);
  if (new Set(nameKeys).size !== nameKeys.length) fail("Duplicate saved filter names in a project");
  for (const project of projects) {
    if (savedFilters.filter((f) => f.projectId === project.id).length > MAX_SAVED_FILTERS_PER_PROJECT) {
      fail(`Project ${project.key} has too many saved filters`);
    }
  }

  return { version: SCHEMA_VERSION, projects, items, statusChanges, notes, savedFilters };
}
