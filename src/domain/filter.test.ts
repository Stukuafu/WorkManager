import { describe, expect, it } from "vitest";
import {
  collectLabels,
  DEFAULT_FILTERS,
  filterItems,
  hasActiveFilters,
  byArchiveMode,
  matchesOnlyInNotes,
  parseLabels,
} from "./filter";
import type { WorkItem } from "./types";

function item(partial: Partial<WorkItem> & { number: number }): WorkItem {
  return {
    id: `id-${partial.number}`,
    projectId: "p",
    title: "Untitled",
    description: "",
    type: "task",
    status: "todo",
    priority: "medium",
    labels: [],
    order: 0,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

const items = [
  item({ number: 1, title: "Login page", labels: ["ui"], priority: "high" }),
  item({ number: 2, title: "Fix crash", type: "bug", status: "in_progress", description: "Null pointer on save" }),
  item({ number: 3, title: "Write docs", status: "done", labels: ["docs", "ui"] }),
  item({ number: 4, title: "Story", type: "story" }),
  item({ number: 5, title: "Child one", parentId: "id-4" }),
  item({ number: 6, title: "Child two", parentId: "id-4" }),
];

describe("filterItems", () => {
  it("returns everything with default filters", () => {
    expect(filterItems(items, DEFAULT_FILTERS, "WM")).toHaveLength(6);
  });

  it("filters by status, priority, type and label", () => {
    expect(filterItems(items, { ...DEFAULT_FILTERS, status: "done" }, "WM").map((i) => i.number)).toEqual([3]);
    expect(filterItems(items, { ...DEFAULT_FILTERS, priority: "high" }, "WM").map((i) => i.number)).toEqual([1]);
    expect(filterItems(items, { ...DEFAULT_FILTERS, type: "bug" }, "WM").map((i) => i.number)).toEqual([2]);
    expect(filterItems(items, { ...DEFAULT_FILTERS, label: "ui" }, "WM").map((i) => i.number)).toEqual([1, 3]);
  });

  it("filters to the tasks of one story", () => {
    expect(filterItems(items, { ...DEFAULT_FILTERS, parent: "id-4" }, "WM").map((i) => i.number)).toEqual([5, 6]);
  });

  it("searches key, title, description and labels case-insensitively", () => {
    const search = (query: string) => filterItems(items, { ...DEFAULT_FILTERS, query }, "WM").map((i) => i.number);
    expect(search("wm-2")).toEqual([2]);
    expect(search("LOGIN")).toEqual([1]);
    expect(search("pointer")).toEqual([2]);
    expect(search("docs")).toEqual([3]);
    expect(search("nothing")).toEqual([]);
  });

  it("combines filters with AND", () => {
    expect(filterItems(items, { ...DEFAULT_FILTERS, label: "ui", status: "done" }, "WM").map((i) => i.number)).toEqual([3]);
  });
});

describe("archive mode", () => {
  const withArchived = [
    item({ number: 1, title: "Active one" }),
    item({ number: 2, title: "Archived one", archivedAt: "2026-11-01T00:00:00.000Z" }),
    item({ number: 3, title: "Active two" }),
  ];
  const numbers = (mode: "hide" | "include" | "only") =>
    filterItems(withArchived, { ...DEFAULT_FILTERS, archived: mode }, "WM").map((i) => i.number);

  it("hides archived items by default", () => {
    expect(filterItems(withArchived, DEFAULT_FILTERS, "WM").map((i) => i.number)).toEqual([1, 3]);
    expect(numbers("hide")).toEqual([1, 3]);
  });

  it("can include them, or show only them", () => {
    expect(numbers("include")).toEqual([1, 2, 3]);
    expect(numbers("only")).toEqual([2]);
  });

  it("combines with search", () => {
    const found = filterItems(withArchived, { ...DEFAULT_FILTERS, archived: "include", query: "archived" }, "WM");
    expect(found.map((i) => i.number)).toEqual([2]);
    expect(filterItems(withArchived, { ...DEFAULT_FILTERS, query: "archived" }, "WM")).toEqual([]);
  });

  it("exposes the archive-only base for counts", () => {
    expect(byArchiveMode(withArchived, "hide")).toHaveLength(2);
    expect(byArchiveMode(withArchived, "only")).toHaveLength(1);
    expect(byArchiveMode(withArchived, "include")).toHaveLength(3);
  });

  it("counts a non-default mode as an active filter", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, archived: "include" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, archived: "hide" })).toBe(false);
  });
});

describe("searching notes", () => {
  const noteText = { "id-1": "reproduced on safari\nwaiting on api team", "id-2": "login page" };

  it("finds items by text that only appears in their notes", () => {
    const search = (query: string) =>
      filterItems(items, { ...DEFAULT_FILTERS, query }, "WM", noteText).map((i) => i.number);
    expect(search("SAFARI")).toEqual([1]);
    expect(search("api team")).toEqual([1]);
    expect(search("nothing anywhere")).toEqual([]);
  });

  it("still matches fields, and combines with other filters", () => {
    const withNotes = (f: Partial<typeof DEFAULT_FILTERS>) =>
      filterItems(items, { ...DEFAULT_FILTERS, ...f }, "WM", noteText).map((i) => i.number);
    expect(withNotes({ query: "login" })).toEqual([1, 2]);
    expect(withNotes({ query: "login", type: "bug" })).toEqual([2]);
  });

  it("does not search notes when none are provided", () => {
    expect(filterItems(items, { ...DEFAULT_FILTERS, query: "safari" }, "WM")).toEqual([]);
  });

  it("explains a match that comes only from notes", () => {
    expect(matchesOnlyInNotes(items[0], "safari", "WM", noteText)).toBe(true);
    expect(matchesOnlyInNotes(items[0], "login", "WM", noteText)).toBe(false); // in the title
    expect(matchesOnlyInNotes(items[0], "", "WM", noteText)).toBe(false);
    expect(matchesOnlyInNotes(items[2], "safari", "WM", noteText)).toBe(false);
  });
});

describe("helpers", () => {
  it("collects distinct sorted labels", () => {
    expect(collectLabels(items)).toEqual(["docs", "ui"]);
  });

  it("parses labels", () => {
    expect(parseLabels(" a, b ,a,, ")).toEqual(["a", "b"]);
    expect(parseLabels("")).toEqual([]);
  });

  it("detects active filters", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: " x " })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: "  " })).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, parent: "x" })).toBe(true);
  });
});
