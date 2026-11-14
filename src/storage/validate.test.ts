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
const valid = () => ({
  version: 1,
  projects: [{ ...project }],
  items: [{ ...item }],
  statusChanges: [{ id: "c1", itemId: "i1", from: null, to: "todo", at: "t" }],
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
  });
});
