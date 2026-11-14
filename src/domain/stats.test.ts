import { describe, expect, it } from "vitest";
import { projectStats, todayString } from "./stats";
import type { Status, WorkItem } from "./types";

function item(status: Status, dueDate?: string): WorkItem {
  return {
    id: Math.random().toString(),
    projectId: "p",
    number: 1,
    title: "t",
    description: "",
    type: "task",
    status,
    priority: "medium",
    labels: [],
    dueDate,
    order: 0,
    createdAt: "",
    updatedAt: "",
  };
}

describe("projectStats", () => {
  it("counts open, done and overdue items", () => {
    const stats = projectStats(
      [item("todo", "2026-01-01"), item("done", "2026-01-01"), item("in_review", "2099-01-01"), item("todo")],
      "2026-11-14",
    );
    expect(stats).toEqual({ total: 4, open: 3, done: 1, overdue: 1, archived: 0 });
  });

  it("does not count items due today as overdue", () => {
    expect(projectStats([item("todo", "2026-11-14")], "2026-11-14").overdue).toBe(0);
  });

  it("leaves archived items out of the counts and reports how many there are", () => {
    const archived = { ...item("done"), archivedAt: "2026-11-01T00:00:00.000Z" };
    const lateArchived = { ...item("todo", "2020-01-01"), archivedAt: "2026-11-01T00:00:00.000Z" };
    expect(projectStats([item("todo"), item("done"), archived, lateArchived], "2026-11-14")).toEqual({
      total: 2,
      open: 1,
      done: 1,
      overdue: 0,
      archived: 2,
    });
  });

  it("handles no items", () => {
    expect(projectStats([], "2026-11-14")).toEqual({ total: 0, open: 0, done: 0, overdue: 0, archived: 0 });
  });
});

describe("todayString", () => {
  it("formats local dates with padding", () => {
    expect(todayString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
