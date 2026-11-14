import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS } from "./filter";
import { checkFilterName, equalFilters, normalizeFilters, sanitizeFilters } from "./savedFilters";
import type { WorkItem } from "./types";

function item(number: number, extra: Partial<WorkItem> = {}): WorkItem {
  return {
    id: `i${number}`,
    projectId: "p",
    number,
    title: "t",
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

describe("equalFilters", () => {
  it("compares every field, with the search text trimmed", () => {
    expect(equalFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, query: "  " })).toBe(true);
    expect(equalFilters({ ...DEFAULT_FILTERS, query: " a " }, { ...DEFAULT_FILTERS, query: "a" })).toBe(true);
    for (const change of [
      { query: "x" },
      { status: "done" as const },
      { priority: "high" as const },
      { type: "bug" as const },
      { label: "ui" },
      { parent: "s" },
    ]) {
      expect(equalFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, ...change })).toBe(false);
    }
  });
});

describe("normalizeFilters", () => {
  it("trims the search text", () => {
    expect(normalizeFilters({ ...DEFAULT_FILTERS, query: "  hi " }).query).toBe("hi");
  });
});

describe("sanitizeFilters", () => {
  const items = [item(1, { type: "story" }), item(2, { labels: ["ui"], parentId: "i1" })];

  it("keeps labels and stories that still exist", () => {
    const filters = { ...DEFAULT_FILTERS, label: "ui", parent: "i1" };
    expect(sanitizeFilters(filters, items)).toEqual(filters);
  });

  it("drops a label or story that is gone", () => {
    const result = sanitizeFilters({ ...DEFAULT_FILTERS, label: "gone", parent: "ghost", status: "done" }, items);
    expect(result).toEqual({ ...DEFAULT_FILTERS, status: "done" });
  });
});

describe("checkFilterName", () => {
  it("trims and accepts normal names", () => {
    expect(checkFilterName("  My bugs ")).toEqual({ name: "My bugs" });
  });

  it("rejects empty and overlong names", () => {
    expect(checkFilterName("   ").error).toMatch(/name/);
    expect(checkFilterName("x".repeat(61)).error).toMatch(/at most 60/);
  });
});
