import { describe, expect, it } from "vitest";
import { RepositoryError } from "./repository";
import { parseStoredData } from "./validate";

const project = { id: "p1", key: "WM", name: "Work Manager", nextNumber: 3, createdAt: "t", updatedAt: "t" };
const item = {
  id: "i1",
  projectId: "p1",
  number: 1,
  title: "A",
  description: "",
  type: "task",
  status: "todo",
  priority: "medium",
  labels: ["x"],
  order: 0,
  createdAt: "t",
  updatedAt: "t",
};
const note = { id: "n1", itemId: "i1", body: "hello", createdAt: "t", updatedAt: "t" };
const savedFilter = {
  id: "f1",
  projectId: "p1",
  name: "My bugs",
  filters: { query: "crash", status: "all", priority: "high", type: "bug", label: "all", parent: "all" },
  createdAt: "t",
  updatedAt: "t",
};
const valid = () => ({
  version: 4,
  projects: [{ ...project }],
  items: [{ ...item }],
  statusChanges: [{ id: "c1", itemId: "i1", from: null, to: "todo", at: "t" }],
  notes: [{ ...note }],
  savedFilters: [{ ...savedFilter, filters: { ...savedFilter.filters } }],
});

describe("parseStoredData", () => {
  it("accepts valid data and round-trips it", () => {
    expect(parseStoredData(valid())).toEqual(valid());
  });

  it("drops unknown extra fields", () => {
    const data = valid() as Record<string, unknown>;
    (data.items as Record<string, unknown>[])[0].surprise = true;
    expect(parseStoredData(data).items[0]).not.toHaveProperty("surprise");
  });

  it("raises a project counter that is behind its items", () => {
    const data = valid();
    data.projects[0].nextNumber = 1;
    expect(parseStoredData(data).projects[0].nextNumber).toBe(2);
  });

  it("migrates version 1 data (no notes) to the current version", () => {
    const { notes: _notes, savedFilters: _filters, ...v1 } = valid();
    const result = parseStoredData({ ...v1, version: 1 });
    expect(result.version).toBe(4);
    expect(result.notes).toEqual([]);
    expect(result.savedFilters).toEqual([]);
    expect(result.items).toEqual(valid().items);
  });

  it("migrates version 2 data (notes, no parent links) to the current version", () => {
    const { savedFilters: _filters, ...v2 } = valid();
    const result = parseStoredData({ ...v2, version: 2 });
    expect(result.version).toBe(4);
    expect(result.notes).toHaveLength(1);
    expect(result.savedFilters).toEqual([]);
  });

  it("migrates version 3 data (no saved filters) to the current version", () => {
    const { savedFilters: _filters, ...v3 } = valid();
    const result = parseStoredData({ ...v3, version: 3 });
    expect(result.version).toBe(4);
    expect(result.savedFilters).toEqual([]);
    expect(result.notes).toHaveLength(1);
  });

  it("keeps valid parent links", () => {
    const data = valid();
    data.items.push(
      { ...item, id: "s1", number: 2, type: "story" },
      { ...item, id: "t1", number: 3, parentId: "s1" } as (typeof item) & { parentId: string },
    );
    expect(parseStoredData(data).items.find((i) => i.id === "t1")?.parentId).toBe("s1");
  });

  it("drops notes for items that do not exist", () => {
    const data = valid();
    data.notes.push({ ...note, id: "n2", itemId: "ghost" });
    expect(parseStoredData(data).notes).toHaveLength(1);
  });

  it("drops history for items that do not exist", () => {
    const data = valid();
    data.statusChanges.push({ id: "c2", itemId: "ghost", from: null, to: "todo", at: "t" });
    expect(parseStoredData(data).statusChanges).toHaveLength(1);
  });

  const bad: [string, (d: ReturnType<typeof valid>) => void, RegExp][] = [
    ["bad project key", (d) => (d.projects[0].key = "w1"), /key/],
    ["duplicate project keys", (d) => d.projects.push({ ...project, id: "p2" }), /Duplicate project keys/],
    ["unknown project on item", (d) => (d.items[0].projectId = "nope"), /unknown project/],
    ["invalid status", (d) => ((d.items[0] as Record<string, unknown>).status = "bogus"), /status/],
    ["duplicate item numbers", (d) => d.items.push({ ...item, id: "i2" }), /duplicate item number/],
    ["non-text title", (d) => ((d.items[0] as Record<string, unknown>).title = 5), /title/],
    ["labels not a list", (d) => ((d.items[0] as Record<string, unknown>).labels = "x"), /labels/],
    ["bad status change", (d) => ((d.statusChanges[0] as Record<string, unknown>).to = "nope"), /"to"/],
    ["future version", (d) => (d.version = 99), /version/],
    ["saved filter for an unknown project", (d) => (d.savedFilters[0].projectId = "ghost"), /unknown project/],
    ["saved filter with a blank name", (d) => (d.savedFilters[0].name = "  "), /"name"/],
    ["saved filter with a bad status", (d) => ((d.savedFilters[0].filters as Record<string, unknown>).status = "bogus"), /status/],
    ["saved filter with non-text search", (d) => ((d.savedFilters[0].filters as Record<string, unknown>).query = 5), /query/],
    ["saved filter with overlong search", (d) => (d.savedFilters[0].filters.query = "x".repeat(201)), /too long/],
    ["saved filter without filters", (d) => ((d.savedFilters[0] as Record<string, unknown>).filters = null), /"filters"/],
    ["duplicate saved filter ids", (d) => d.savedFilters.push({ ...savedFilter, name: "Other" }), /Duplicate saved filter ids/],
    ["duplicate saved filter names", (d) => d.savedFilters.push({ ...savedFilter, id: "f2", name: "MY BUGS" }), /Duplicate saved filter names/],
    ["parent that does not exist", (d) => ((d.items[0] as Record<string, unknown>).parentId = "ghost"), /no longer exists/],
    ["parent that is not a story", (d) => d.items.push({ ...item, id: "t2", number: 2, parentId: "i1" } as typeof item), /Only stories/],
    ["story with a parent", (d) => d.items.push({ ...item, id: "s2", number: 2, type: "story", parentId: "i1" } as typeof item), /story can't belong/],
    ["non-text parent id", (d) => ((d.items[0] as Record<string, unknown>).parentId = 5), /parentId/],
    ["empty note", (d) => (d.notes[0].body = "   "), /must not be empty/],
    ["overlong note", (d) => (d.notes[0].body = "x".repeat(10_001)), /too long/],
    ["non-text note body", (d) => ((d.notes[0] as Record<string, unknown>).body = 5), /body/],
    ["duplicate note ids", (d) => d.notes.push({ ...note }), /Duplicate note ids/],
  ];
  for (const [name, mutate, message] of bad) {
    it(`rejects ${name}`, () => {
      const data = valid();
      mutate(data);
      expect(() => parseStoredData(data)).toThrow(RepositoryError);
      expect(() => parseStoredData(data)).toThrow(message);
    });
  }

  it("rejects non-objects and missing lists", () => {
    expect(() => parseStoredData(null)).toThrow(RepositoryError);
    expect(() => parseStoredData([])).toThrow(RepositoryError);
    expect(() => parseStoredData({ version: 1, projects: [], items: [] })).toThrow(/statusChanges/);
    const noNotes = valid() as Record<string, unknown>;
    delete noNotes.notes;
    expect(() => parseStoredData(noNotes)).toThrow(/"notes"/);
    const noFilters = valid() as Record<string, unknown>;
    delete noFilters.savedFilters;
    expect(() => parseStoredData(noFilters)).toThrow(/"savedFilters"/);
  });
});
