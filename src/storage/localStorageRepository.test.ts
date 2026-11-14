import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageRepository } from "./localStorageRepository";
import { RepositoryError } from "./repository";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

let storage: MemoryStorage;
let repo: LocalStorageRepository;

beforeEach(() => {
  storage = new MemoryStorage();
  repo = new LocalStorageRepository(storage);
});

describe("projects", () => {
  it("creates a project with a normalized key", async () => {
    const p = await repo.createProject({ key: " wm ", name: " Work Manager " });
    expect(p.key).toBe("WM");
    expect(p.name).toBe("Work Manager");
    expect(p.nextNumber).toBe(1);
  });

  it("rejects invalid or duplicate keys", async () => {
    await repo.createProject({ key: "WM", name: "One" });
    await expect(repo.createProject({ key: "WM", name: "Two" })).rejects.toThrow(RepositoryError);
    await expect(repo.createProject({ key: "1", name: "Bad" })).rejects.toThrow(RepositoryError);
    await expect(repo.createProject({ key: "OK", name: " " })).rejects.toThrow(RepositoryError);
  });
});

describe("items", () => {
  it("assigns sequential numbers and never reuses them after delete", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    expect([a.number, b.number]).toEqual([1, 2]);

    await repo.deleteItem(b.id);
    const c = await repo.createItem(p.id, { title: "C" });
    expect(c.number).toBe(3);
    expect((await repo.getProject(p.id))?.nextNumber).toBe(4);
  });

  it("keeps numbering independent per project", async () => {
    const p1 = await repo.createProject({ key: "AA", name: "One" });
    const p2 = await repo.createProject({ key: "BB", name: "Two" });
    await repo.createItem(p1.id, { title: "x" });
    const item = await repo.createItem(p2.id, { title: "y" });
    expect(item.number).toBe(1);
  });

  it("applies defaults and validates the title", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "  Do it  " });
    expect(item).toMatchObject({
      title: "Do it",
      status: "todo",
      priority: "medium",
      type: "task",
      labels: [],
    });
    await expect(repo.createItem(p.id, { title: "  " })).rejects.toThrow(RepositoryError);
    await expect(repo.createItem("missing", { title: "x" })).rejects.toThrow(RepositoryError);
  });

  it("orders new items at the end of their column", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    const c = await repo.createItem(p.id, { title: "C", status: "done" });
    expect([a.order, b.order, c.order]).toEqual([0, 1, 0]);
  });

  it("tracks status history and completedAt", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "A" });

    const done = await repo.updateItem(item.id, { status: "done" });
    expect(done.completedAt).toBeDefined();

    const reopened = await repo.updateItem(item.id, { status: "in_progress" });
    expect(reopened.completedAt).toBeUndefined();

    const history = await repo.listStatusChanges(item.id);
    expect(history.map((h) => [h.from, h.to])).toEqual([
      [null, "todo"],
      ["todo", "done"],
      ["done", "in_progress"],
    ]);
  });

  it("does not log a status change when status is unchanged", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "A" });
    await repo.updateItem(item.id, { title: "A2", status: "todo" });
    expect(await repo.listStatusChanges(item.id)).toHaveLength(1);
  });

  it("rejects invalid updates", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const item = await repo.createItem(p.id, { title: "A" });
    await expect(repo.updateItem(item.id, { title: " " })).rejects.toThrow(RepositoryError);
    await expect(repo.updateItem("missing", { title: "x" })).rejects.toThrow(RepositoryError);
    await expect(
      repo.updateItem(item.id, { status: "bogus" as never }),
    ).rejects.toThrow(RepositoryError);
  });
});

describe("moving items", () => {
  async function setup() {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    const a = await repo.createItem(p.id, { title: "A" });
    const b = await repo.createItem(p.id, { title: "B" });
    const c = await repo.createItem(p.id, { title: "C" });
    return { p, a, b, c };
  }

  it("moves between columns, renumbers both, and logs the change", async () => {
    const { p, a, b, c } = await setup();
    await repo.moveItem(a.id, "done", 0);

    const items = await repo.listItems(p.id);
    const byId = Object.fromEntries(items.map((i) => [i.title, i]));
    expect(byId.A).toMatchObject({ status: "done", order: 0 });
    expect(byId.A.completedAt).toBeDefined();
    expect([byId.B.order, byId.C.order]).toEqual([0, 1]);
    expect(b.id).toBe(byId.B.id);
    expect(c.id).toBe(byId.C.id);

    const history = await repo.listStatusChanges(a.id);
    expect(history.at(-1)).toMatchObject({ from: "todo", to: "done" });
  });

  it("reorders within a column without logging a status change", async () => {
    const { p, a, c } = await setup();
    await repo.moveItem(c.id, "todo", 0);
    const items = (await repo.listItems(p.id)).sort((x, y) => x.order - y.order);
    expect(items.map((i) => i.title)).toEqual(["C", "A", "B"]);
    expect(await repo.listStatusChanges(c.id)).toHaveLength(1);
    expect(a.id).toBeDefined();
  });

  it("clears completedAt when moved out of done", async () => {
    const { a } = await setup();
    await repo.moveItem(a.id, "done", 0);
    await repo.moveItem(a.id, "in_review", 0);
    const [item] = (await repo.exportData()).items.filter((i) => i.id === a.id);
    expect(item.completedAt).toBeUndefined();
  });

  it("is a no-op when dropped in place, and rejects bad input", async () => {
    const { a } = await setup();
    expect(await repo.moveItem(a.id, "todo", 0)).toEqual([]);
    await expect(repo.moveItem("missing", "todo", 0)).rejects.toThrow(RepositoryError);
    await expect(repo.moveItem(a.id, "bogus" as never, 0)).rejects.toThrow(RepositoryError);
  });

  it("puts an item changed via updateItem at the bottom of the new column", async () => {
    const { p, a, b } = await setup();
    await repo.updateItem(a.id, { status: "in_progress" });
    const moved = await repo.updateItem(b.id, { status: "in_progress" });
    expect(moved.order).toBe(1);
    expect((await repo.listItems(p.id)).find((i) => i.id === a.id)?.order).toBe(0);
  });
});

describe("export / import", () => {
  it("round-trips data", async () => {
    const p = await repo.createProject({ key: "WM", name: "Work Manager" });
    await repo.createItem(p.id, { title: "A" });
    const exported = await repo.exportData();

    const other = new LocalStorageRepository(new MemoryStorage());
    await other.importData(JSON.parse(JSON.stringify(exported)));
    expect(await other.exportData()).toEqual(exported);
  });

  it("rejects malformed or future-version data", async () => {
    await expect(repo.importData(null)).rejects.toThrow(RepositoryError);
    await expect(repo.importData({ version: 99, projects: [], items: [], statusChanges: [] })).rejects.toThrow(
      RepositoryError,
    );
    await expect(repo.importData({ version: 1, projects: [] })).rejects.toThrow(RepositoryError);
  });

  it("reports corrupted stored data", async () => {
    storage.setItem("work-manager:data", "{not json");
    await expect(repo.listProjects()).rejects.toThrow(RepositoryError);
  });
});
