import { describe, expect, it } from "vitest";
import { DEFAULT_SORT, FIRST_DIRECTION, nextSort, sortItems, type SortField } from "./sort";
import type { WorkItem } from "./types";

function item(number: number, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id: `i${number}`,
    projectId: "p",
    number,
    title: `Item ${number}`,
    description: "",
    type: "task",
    status: "todo",
    priority: "medium",
    labels: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const items = [
  item(1, { title: "banana", priority: "low", status: "done", type: "story", dueDate: "2026-12-01" }),
  item(2, { title: "Apple", priority: "critical", status: "todo", type: "bug", dueDate: "2026-11-01" }),
  item(3, { title: "cherry", priority: "high", status: "in_review", type: "task" }),
  item(4, { title: "Date", priority: "medium", status: "in_progress", type: "task", dueDate: "2026-11-15" }),
];
const order = (sorted: WorkItem[]) => sorted.map((i) => i.number);

describe("sortItems", () => {
  it("sorts by key, newest first by default", () => {
    expect(order(sortItems(items, DEFAULT_SORT))).toEqual([4, 3, 2, 1]);
    expect(order(sortItems(items, { field: "key", direction: "asc" }))).toEqual([1, 2, 3, 4]);
  });

  it("sorts titles case-insensitively", () => {
    expect(order(sortItems(items, { field: "title", direction: "asc" }))).toEqual([2, 1, 3, 4]);
    expect(order(sortItems(items, { field: "title", direction: "desc" }))).toEqual([4, 3, 1, 2]);
  });

  it("sorts priority by importance, not alphabetically", () => {
    expect(order(sortItems(items, { field: "priority", direction: "desc" }))).toEqual([2, 3, 4, 1]);
    expect(order(sortItems(items, { field: "priority", direction: "asc" }))).toEqual([1, 4, 3, 2]);
  });

  it("sorts status in workflow order", () => {
    expect(order(sortItems(items, { field: "status", direction: "asc" }))).toEqual([2, 4, 3, 1]);
  });

  it("sorts type as task, bug, story", () => {
    expect(order(sortItems(items, { field: "type", direction: "asc" }))).toEqual([4, 3, 2, 1]);
  });

  it("sorts by due date and keeps items without one last in both directions", () => {
    expect(order(sortItems(items, { field: "due", direction: "asc" }))).toEqual([2, 4, 1, 3]);
    expect(order(sortItems(items, { field: "due", direction: "desc" }))).toEqual([1, 4, 2, 3]);
  });

  it("breaks ties with the newest item first", () => {
    const tied = [item(1), item(2), item(3)];
    expect(order(sortItems(tied, { field: "priority", direction: "asc" }))).toEqual([3, 2, 1]);
    expect(order(sortItems(tied, { field: "priority", direction: "desc" }))).toEqual([3, 2, 1]);
  });

  it("does not change the original array", () => {
    const copy = [...items];
    sortItems(items, { field: "title", direction: "asc" });
    expect(items).toEqual(copy);
  });
});

describe("nextSort", () => {
  it("starts a new column at its natural direction", () => {
    expect(nextSort(DEFAULT_SORT, "priority")).toEqual({ field: "priority", direction: "desc" });
    expect(nextSort(DEFAULT_SORT, "title")).toEqual({ field: "title", direction: "asc" });
  });

  it("flips the active column", () => {
    expect(nextSort({ field: "title", direction: "asc" }, "title")).toEqual({ field: "title", direction: "desc" });
    expect(nextSort({ field: "title", direction: "desc" }, "title")).toEqual({ field: "title", direction: "asc" });
  });

  it("has a first direction for every field", () => {
    const fields: SortField[] = ["key", "title", "type", "priority", "status", "due"];
    for (const f of fields) expect(FIRST_DIRECTION[f]).toBeDefined();
  });
});
