import { describe, expect, it } from "vitest";
import { buildColumns, planMove } from "./board";
import type { Status, WorkItem } from "./types";

function item(number: number, status: Status, order: number): WorkItem {
  return {
    id: `i${number}`,
    projectId: "p",
    number,
    title: `Item ${number}`,
    description: "",
    type: "task",
    status,
    priority: "medium",
    labels: [],
    order,
    createdAt: "",
    updatedAt: "",
  };
}

// todo: i1, i2, i3   in_progress: i4   done: i5
const items = [
  item(1, "todo", 0),
  item(2, "todo", 1),
  item(3, "todo", 2),
  item(4, "in_progress", 0),
  item(5, "done", 0),
];

describe("buildColumns", () => {
  it("groups ids by status in order", () => {
    expect(buildColumns([item(2, "todo", 1), item(1, "todo", 0), item(3, "done", 0)])).toEqual({
      todo: ["i1", "i2"],
      in_progress: [],
      in_review: [],
      done: ["i3"],
    });
  });
});

describe("planMove", () => {
  it("reorders within a column", () => {
    const changes = planMove(items, "i3", "todo", 0);
    expect(changes).toEqual([
      { id: "i3", status: "todo", order: 0 },
      { id: "i1", status: "todo", order: 1 },
      { id: "i2", status: "todo", order: 2 },
    ]);
  });

  it("moves to another column and closes the gap in the source", () => {
    const changes = planMove(items, "i1", "in_progress", 1);
    expect(changes).toEqual([
      { id: "i1", status: "in_progress", order: 1 },
      { id: "i2", status: "todo", order: 0 },
      { id: "i3", status: "todo", order: 1 },
    ]);
  });

  it("moves into an empty column", () => {
    expect(planMove(items, "i2", "in_review", 0)).toContainEqual({ id: "i2", status: "in_review", order: 0 });
  });

  it("inserts at the top of a populated column and shifts the rest", () => {
    const changes = planMove(items, "i1", "done", 0);
    expect(changes).toContainEqual({ id: "i1", status: "done", order: 0 });
    expect(changes).toContainEqual({ id: "i5", status: "done", order: 1 });
  });

  it("clamps out-of-range indexes", () => {
    expect(planMove(items, "i1", "done", 99)).toContainEqual({ id: "i1", status: "done", order: 1 });
    expect(planMove(items, "i1", "done", -5)).toContainEqual({ id: "i1", status: "done", order: 0 });
  });

  it("returns nothing when the item is dropped where it already is", () => {
    expect(planMove(items, "i2", "todo", 1)).toEqual([]);
  });

  it("throws for an unknown item", () => {
    expect(() => planMove(items, "nope", "todo", 0)).toThrow(/not found/);
  });
});
