import { describe, expect, it } from "vitest";
import { allStories, childrenOf, parentError, storiesIn, storyProgress } from "./hierarchy";
import type { ItemType, Status, WorkItem } from "./types";

function item(number: number, type: ItemType, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id: `i${number}`,
    projectId: "p",
    number,
    title: `Item ${number}`,
    description: "",
    type,
    status: "todo" as Status,
    priority: "medium",
    labels: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const items = [
  item(1, "story"),
  item(2, "task", { parentId: "i1", status: "done" }),
  item(3, "bug", { parentId: "i1" }),
  item(4, "task", { parentId: "i1", status: "done" }),
  item(5, "task"),
  item(6, "story"),
  item(7, "task", { projectId: "other" }),
];

describe("parentError", () => {
  it("allows no parent and a valid story parent", () => {
    expect(parentError(items, { type: "task", projectId: "p" }, undefined)).toBeNull();
    expect(parentError(items, { type: "task", projectId: "p" }, "i1")).toBeNull();
    expect(parentError(items, { type: "bug", projectId: "p" }, "i6")).toBeNull();
  });

  it("rejects a story with a parent", () => {
    expect(parentError(items, { type: "story", projectId: "p" }, "i1")).toMatch(/story can't belong/);
  });

  it("rejects non-story, missing and cross-project parents", () => {
    expect(parentError(items, { type: "task", projectId: "p" }, "i5")).toMatch(/Only stories/);
    expect(parentError(items, { type: "task", projectId: "p" }, "nope")).toMatch(/no longer exists/);
    expect(parentError(items, { type: "task", projectId: "elsewhere" }, "i1")).toMatch(/different project/);
  });
});

describe("childrenOf / storiesIn", () => {
  it("lists children in key order", () => {
    expect(childrenOf(items, "i1").map((i) => i.number)).toEqual([2, 3, 4]);
    expect(childrenOf(items, "i6")).toEqual([]);
  });

  it("lists stories, optionally excluding one", () => {
    expect(storiesIn(items).map((i) => i.number)).toEqual([1, 6]);
    expect(storiesIn(items, "i1").map((i) => i.number)).toEqual([6]);
  });
});

describe("storyProgress", () => {
  it("counts done tasks", () => {
    expect(storyProgress(items, "i1")).toEqual({ done: 2, total: 3, percent: 67 });
  });

  it("is zero for a story with no tasks", () => {
    expect(storyProgress(items, "i6")).toEqual({ done: 0, total: 0, percent: 0 });
  });
});

describe("archived stories", () => {
  const archivedStory = { ...item(6, "story"), archivedAt: "2026-11-01T00:00:00.000Z" };
  const all = [item(1, "story"), archivedStory];

  it("are not offered as parents, unless they are the current parent", () => {
    expect(storiesIn(all).map((i) => i.number)).toEqual([1]);
    expect(storiesIn(all, undefined, "i6").map((i) => i.number)).toEqual([1, 6]);
  });

  it("are still listed by allStories", () => {
    expect(allStories(all).map((i) => i.number)).toEqual([1, 6]);
  });

  it("still count towards a story's progress", () => {
    const withTasks = [
      item(1, "story"),
      item(2, "task", { parentId: "i1", status: "done", archivedAt: "2026-11-01T00:00:00.000Z" }),
      item(3, "task", { parentId: "i1" }),
    ];
    expect(storyProgress(withTasks, "i1")).toEqual({ done: 1, total: 2, percent: 50 });
  });
});
